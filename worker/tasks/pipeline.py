from celery import chain
from tasks.clone_task import clone_repo
from tasks.parse_task import parse_repo
from tasks.embed_task import embed_repo
from tasks.docs_task import generate_docs
from tasks.graph_task import build_graph

def run_analysis_pipeline(workspace_id: int, repo_url: str, branch: str = "main"):
    pipeline = chain(
        clone_repo.s(workspace_id, repo_url, branch),
        parse_repo.s(),
        embed_repo.s(),
        generate_docs.s(),
        build_graph.s(),
    )
    result = pipeline.apply_async()
    result.parent or result
    return result

def handle_pipeline_error(task_id, exc, traceback, workspace_id=None):
    if workspace_id:
        from db_utils import get_sync_engine
        from sqlalchemy import update
        from app.models.workspace import Workspace
        engine = get_sync_engine()
        with engine.connect() as conn:
            conn.execute(
                update(Workspace).where(Workspace.id == workspace_id).values(
                    status="error"
                )
            )
            conn.commit()
