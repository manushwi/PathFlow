from itsdangerous import URLSafeTimedSerializer
from app.core.config import settings

serializer = URLSafeTimedSerializer(settings.secret_key)

def create_session_token(user_id: int) -> str:
    return serializer.dumps({"user_id": user_id})

def verify_session_token(token: str, max_age: int = 86400 * 30) -> int | None:
    try:
        data = serializer.loads(token, max_age=max_age)
        return data["user_id"]
    except Exception:
        return None
