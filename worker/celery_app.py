from celery import Celery
app = Celery("patchflow")
app.config_from_object("celeryconfig")
app.autodiscover_tasks(["tasks"], force=True)
import tasks.clone_task, tasks.parse_task, tasks.embed_task, tasks.docs_task, tasks.graph_task, tasks.pipeline  # noqa: ensure all tasks loaded
