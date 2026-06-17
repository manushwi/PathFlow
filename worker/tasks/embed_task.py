from celery_app import app
import os, asyncio
from constants import REPOS_BASE_PATH, CHUNK_SIZE, CHUNK_OVERLAP
from db_utils import get_sync_engine

def chunk_file(content: str, file_path: str, max_chars: int = CHUNK_SIZE) -> list[dict]:
    chunks = []
    lines = content.split("\n")
    current, current_lines = [], 0
    for line in lines:
        current.append(line)
        current_lines += len(line)
        if current_lines >= max_chars:
            chunks.append({"file_path": file_path, "content": "\n".join(current), "chunk_index": len(chunks)})
            current, current_lines = current[-20:], sum(len(l) for l in current[-20:])
    if current:
        chunks.append({"file_path": file_path, "content": "\n".join(current), "chunk_index": len(chunks)})
    return chunks

@app.task(bind=True, name="tasks.embed")
def embed_repo(self, prev_result: dict):
    try:
        workspace_id = prev_result["workspace_id"]
        repo_path = prev_result["repo_path"]
        all_files = prev_result["all_files"]
        self.update_state(state="PROGRESS", meta={"status": "embedding", "progress": 45})
        IMPORTANT_EXTS = {'.py', '.js', '.ts', '.tsx', '.jsx'}
        MAX_FILES = 60
        priority_files = [f for f in all_files if f["ext"] in IMPORTANT_EXTS and f["size"] < 50000][:MAX_FILES]
        all_chunks = []
        for f in priority_files:
            fpath = os.path.join(repo_path, f["path"])
            try:
                with open(fpath, "r", encoding="utf-8", errors="ignore") as fh:
                    content = fh.read()
                chunks = chunk_file(content, f["path"])
                all_chunks.extend(chunks)
            except Exception:
                continue
        async def do_embed():
            from app.services.ai_service import get_embeddings
            from app.services.vector_service import ensure_collection, upsert_chunks, delete_workspace_vectors
            await ensure_collection()
            await delete_workspace_vectors(workspace_id)
            batch_size = 50
            sem = asyncio.Semaphore(5)
            async def process_batch(batch):
                async with sem:
                    texts = [c["content"][:2000] for c in batch]
                    embeddings = await get_embeddings(texts)
                    await upsert_chunks(workspace_id, batch, embeddings)
                    return len(batch)
            batches = [all_chunks[i:i+batch_size] for i in range(0, len(all_chunks), batch_size)]
            results = await asyncio.gather(*[process_batch(b) for b in batches], return_exceptions=True)
            total_embedded = sum(r for r in results if isinstance(r, int))
            return total_embedded
        try:
            total = asyncio.run(do_embed())
        except Exception:
            total = 0
        if total > 0:
            _update_status(workspace_id, "generating_docs")
        else:
            _update_status(workspace_id, "error")
        return {**prev_result, "chunks_embedded": total}
    except Exception:
        from sqlalchemy import update
        from app.models.workspace import Workspace
        engine = get_sync_engine()
        with engine.connect() as conn:
            conn.execute(update(Workspace).where(Workspace.id == workspace_id).values(status="error"))
            conn.commit()
        raise

def _update_status(workspace_id, status):
    from sqlalchemy import update
    from sqlalchemy.orm import sessionmaker
    from app.models.workspace import Workspace
    engine = get_sync_engine()
    Session = sessionmaker(bind=engine)
    with Session() as session:
        session.execute(update(Workspace).where(Workspace.id == workspace_id).values(status=status))
        session.commit()
