from app.core.config import settings

broker_url = settings.celery_broker_url
result_backend = settings.celery_result_backend
task_default_queue = "default"
task_default_exchange = "default"
task_default_routing_key = "default"
task_serializer = "json"
result_serializer = "json"
accept_content = ["json"]
timezone = "UTC"
task_track_started = True
task_ignore_result = True