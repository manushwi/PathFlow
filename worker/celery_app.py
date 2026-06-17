from celery import Celery

app = Celery("patchflow")
app.config_from_object("celeryconfig")
app.conf.imports = (
    "tasks.clone_task",
    "tasks.parse_task",
    "tasks.embed_task",
    "tasks.docs_task",
    "tasks.graph_task",
    "tasks.pipeline",
)