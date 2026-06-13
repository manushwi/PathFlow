from celery import app
from celery import chain, chord, group, shared_task
from tasks.clone_task import clone_repo
from tasks.parse_task import parse_repo
from tasks.embed_task import embed_repo
from tasks.docs_task import generate_docs
from tasks.graph_task import build_graph
import logging

logger = logging.getLogger(__name__)


@shared_task(name="tasks.pipeline_error_handler")
def pipeline_error_handler(request, exc, traceback, workspace_id=None):
    """
    Celery link_error callback — called when ANY task in the chain raises.
    Sets workspace status to 'error' so the frontend stops polling.
    """
    logger.error(f"Pipeline failed for workspace {workspace_id}: {exc}")
    if workspace_id is None:
        return
    try:
        from db_utils import get_sync_engine
        from sqlalchemy import update
        from app.models.workspace import Workspace
        engine = get_sync_engine()
        with engine.connect() as conn:
            conn.execute(
                update(Workspace)
                .where(Workspace.id == workspace_id)
                .values(status="error")
            )
            conn.commit()
    except Exception as e:
        logger.error(f"Could not update workspace error status: {e}")

@shared_task(name="tasks.pipeline")
def run_analysis_pipeline(workspace_id: int, repo_url: str, branch: str = "main"):
    error_handler = pipeline_error_handler.s(workspace_id=workspace_id)
    pipeline = chain(
        clone_repo.s(workspace_id, repo_url, branch),
        parse_repo.s(),
        chord(
            group(embed_repo.s(), generate_docs.s()),
            build_graph.s(),
        ),
    ).on_error(error_handler)
    return pipeline.apply_async()