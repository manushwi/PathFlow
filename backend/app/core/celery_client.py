from celery import Celery
from app.core.config import settings

_celery = None

def _get_celery() -> Celery:
    global _celery
    if _celery is None:
        _celery = Celery(broker=settings.celery_broker_url)
    return _celery

def send_pipeline_task(workspace_id: int, repo_url: str, branch: str = "main"):
    """
    Send a task message to the Celery broker.
    The backend never imports worker code — it only sends a message.
    """
    celery = _get_celery()
    celery.send_task(
        "tasks.clone",
        args=[workspace_id, repo_url, branch],
        queue="celery",
    )