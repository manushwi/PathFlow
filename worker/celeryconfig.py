import sys, os
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../backend'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from app.core.config import settings

broker_url = settings.celery_broker_url
result_backend = settings.celery_result_backend
task_serializer = "json"
result_serializer = "json"
accept_content = ["json"]
timezone = "UTC"
task_track_started = True
