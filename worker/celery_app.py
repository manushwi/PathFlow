from celery import Celery
app = Celery("patchflow")
app.config_from_object("celeryconfig")
app.conf.imports = (
    "worker.tasks.clone_task",
    "worker.tasks.parse_task",
    "worker.tasks.embed_task",
    "worker.tasks.docs_task",
    "worker.tasks.graph_task",
)