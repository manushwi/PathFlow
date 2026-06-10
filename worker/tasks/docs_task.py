from celery_app import app
import os, sys, asyncio, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../shared'))
from constants import REPOS_BASE_PATH
from prompts import SYSTEM_REPO_DOCS, build_repo_docs_prompt
from db_utils import get_sync_engine

@app.task(bind=True, name="tasks.docs")
def generate_docs(self, prev_result: dict):
    try:
        workspace_id = prev_result["workspace_id"]
        repo_path = prev_result["repo_path"]
        tech_stack = prev_result.get("tech_stack", {}).get("detected", [])
        self.update_state(state="PROGRESS", meta={"status": "generating_docs", "progress": 65})
        readme = ""
        for fname in ["README.md", "readme.md", "README.rst"]:
            p = os.path.join(repo_path, fname)
            if os.path.exists(p):
                with open(p, "r", errors="ignore") as f:
                    readme = f.read()[:3000]
                break
        def get_tree():
            from sqlalchemy.orm import sessionmaker
            from app.models.workspace import RepoAnalysis
            engine = get_sync_engine()
            Session = sessionmaker(bind=engine)
            with Session() as session:
                analysis = session.query(RepoAnalysis).filter_by(workspace_id=workspace_id).first()
                return analysis.file_tree if analysis else {}
        file_tree = get_tree()
        tree_str = json.dumps(file_tree, indent=2)[:3000]
        async def do_docs():
            from app.services.ai_service import chat_complete_json
            prompt = build_repo_docs_prompt(tree_str, readme, ", ".join(tech_stack))
            return await chat_complete_json([{"role": "user", "content": prompt}], SYSTEM_REPO_DOCS)
        docs = asyncio.run(do_docs())
        def save_docs(docs_data):
            from sqlalchemy.orm import sessionmaker
            from app.models.workspace import RepoAnalysis
            engine = get_sync_engine()
            Session = sessionmaker(bind=engine)
            with Session() as session:
                analysis = session.query(RepoAnalysis).filter_by(workspace_id=workspace_id).first()
                if analysis:
                    analysis.docs_json = docs_data
                session.commit()
        save_docs(docs)
        _update_status(workspace_id, "building_graph")
        return {**prev_result, "docs": docs}
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
