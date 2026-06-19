import os
from typing import Optional
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    github_client_id: str
    github_client_secret: str
    github_redirect_uri: str
    database_url: str
    redis_url: str = "redis://localhost:6379/0"
    upstash_redis_rest_url: Optional[str] = None
    upstash_redis_rest_token: Optional[str] = None
    qdrant_url: str
    qdrant_api_key: str
    openrouter_api_key: str
    openrouter_model: str = "openai/gpt-oss-120b:free"
    openrouter_embed_model: str = "openai/text-embedding-3-small"
    secret_key: str
    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"
    celery_broker_url: str
    celery_result_backend: str
    environment: str = "development"
    app_url: str = "https://pathflow.dev"

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), ".env")

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()
