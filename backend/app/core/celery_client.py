from celery import Celery
from app.core.config import settings

_celery = None

def _ensure_ssl(url: str) -> str:
    if "rediss://" in url and "ssl_cert_reqs" not in url:
        sep = "&" if "?" in url else "?"
        return f"{url}{sep}ssl_cert_reqs=CERT_REQUIRED"
    return url

def _get_celery() -> Celery:
    global _celery
    if _celery is None:
        broker_url = _ensure_ssl(settings.celery_broker_url)
        _celery = Celery(broker=broker_url, broker_use_ssl={"ssl_cert_reqs": "required"})
    return _celery

def send_pipeline_task(workspace_id: int, repo_url: str, branch: str = "main"):
    """
    Send a task message to the Celery broker.
    The backend never imports worker code — it only sends a message.
    """
    celery = _get_celery()
    celery.send_task(
        "tasks.pipeline",
        args=[workspace_id, repo_url, branch],
        queue="default",
    )