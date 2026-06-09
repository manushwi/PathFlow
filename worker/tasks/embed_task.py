from celery_app import app
import os, sys, asyncio
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../shared'))
from constants import REPOS_BASE_PATH, CHUNK_SIZE, CHUNK_OVERLAP

def chunk_file(content: str, file_path: str, max_chars: int = 3000) -> list[dict]:
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
        from app.services.ai_service import get_embedding
        from app.services.vector_service import ensure_collection, upsert_chunks, delete_workspace_vectors
        await ensure_collection()
        await delete_workspace_vectors(workspace_id)
        batch_size = 20
        for i in range(0, len(all_chunks), batch_size):
            batch = all_chunks[i:i+batch_size]
            embeddings = []
            for chunk in batch:
                emb = await get_embedding(chunk["content"][:2000])
                embeddings.append(emb)
            await upsert_chunks(workspace_id, batch, embeddings)
    asyncio.run(do_embed())
    _update_status(workspace_id, "generating_docs")
    return {**prev_result, "chunks_embedded": len(all_chunks)}

def _update_status(workspace_id, status):
    from sqlalchemy import create_engine, update
    from sqlalchemy.orm import sessionmaker
    from app.core.config import settings
    from app.models.workspace import Workspace
    engine = create_engine(settings.database_url.replace("postgresql://", "postgresql+psycopg2://"))
    Session = sessionmaker(bind=engine)
    with Session() as session:
        session.execute(update(Workspace).where(Workspace.id == workspace_id).values(status=status))
        session.commit()
