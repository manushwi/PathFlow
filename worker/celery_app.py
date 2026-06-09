from celery import Celery
app = Celery("patchflow")
app.config_from_object("celeryconfig")
app.autodiscover_tasks(["tasks"])
