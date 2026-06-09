from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    github_client_id: str
    github_client_secret: str
    github_redirect_uri: str
    database_url: str
    upstash_redis_rest_url: str
    upstash_redis_rest_token: str
    qdrant_url: str
    qdrant_api_key: str
    openrouter_api_key: str
    openrouter_model: str = "openai/gpt-4o-mini"
    openrouter_embed_model: str = "openai/text-embedding-3-small"
    secret_key: str
    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"
    celery_broker_url: str
    celery_result_backend: str

    class Config:
        env_file = "../.env"

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()
