import os

broker_url = os.environ.get("CELERY_BROKER_URL") or os.environ.get("REDIS_URL")
result_backend = os.environ.get("CELERY_RESULT_BACKEND") or os.environ.get("REDIS_URL")
broker_use_ssl = {"ssl_cert_reqs": "required"}
redis_backend_use_ssl = {"ssl_cert_reqs": "required"}
task_default_queue = "default"
task_default_exchange = "default"
task_default_routing_key = "default"
task_serializer = "json"
result_serializer = "json"
accept_content = ["json"]
timezone = "UTC"
task_track_started = True
task_ignore_result = True