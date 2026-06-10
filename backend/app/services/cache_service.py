import json
from typing import Any, Optional
from redis.asyncio import Redis
from app.core.config import settings

_client: Optional[Redis] = None

def _get_client() -> Redis:
    global _client
    if _client is None:
        _client = Redis.from_url(settings.redis_url, decode_responses=True)
    return _client

async def cache_set(key: str, value: Any, ttl: int = 3600):
    client = _get_client()
    data = json.dumps(value)
    await client.set(key, data, ex=ttl)

async def cache_get(key: str) -> Optional[Any]:
    client = _get_client()
    data = await client.get(key)
    if data is not None:
        return json.loads(data)
    return None

async def cache_del(key: str):
    client = _get_client()
    await client.delete(key)
