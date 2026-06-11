import json
import logging
from typing import Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


async def cache_set(key: str, value: Any, ttl: int = 3600) -> None:
    data = json.dumps(value)
    if settings.upstash_redis_rest_url and settings.upstash_redis_rest_token:
        await _upstash_set(key, data, ttl)
    else:
        await _redis_set(key, data, ttl)


async def cache_get(key: str) -> Optional[Any]:
    if settings.upstash_redis_rest_url and settings.upstash_redis_rest_token:
        raw = await _upstash_get(key)
    else:
        raw = await _redis_get(key)
    if raw is not None:
        try:
            return json.loads(raw)
        except Exception:
            return None
    return None


async def cache_del(key: str) -> None:
    if settings.upstash_redis_rest_url and settings.upstash_redis_rest_token:
        await _upstash_del(key)
    else:
        await _redis_del(key)


# ── Upstash REST backend ──────────────────────────────────────────────────────

async def _upstash_set(key: str, value: str, ttl: int) -> None:
    import httpx
    import urllib.parse
    encoded = urllib.parse.quote(value, safe="")
    url = f"{settings.upstash_redis_rest_url}/set/{key}/{encoded}/EX/{ttl}"
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(url, headers={"Authorization": f"Bearer {settings.upstash_redis_rest_token}"})
    except Exception as e:
        logger.warning(f"Upstash cache_set failed: {e}")


async def _upstash_get(key: str) -> Optional[str]:
    import httpx
    url = f"{settings.upstash_redis_rest_url}/get/{key}"
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(url, headers={"Authorization": f"Bearer {settings.upstash_redis_rest_token}"})
            result = r.json().get("result")
            return result
    except Exception as e:
        logger.warning(f"Upstash cache_get failed: {e}")
        return None


async def _upstash_del(key: str) -> None:
    import httpx
    url = f"{settings.upstash_redis_rest_url}/del/{key}"
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(url, headers={"Authorization": f"Bearer {settings.upstash_redis_rest_token}"})
    except Exception as e:
        logger.warning(f"Upstash cache_del failed: {e}")


# ── Standard Redis async backend ─────────────────────────────────────────────

_async_redis = None

def _get_async_redis():
    global _async_redis
    if _async_redis is None:
        from redis.asyncio import Redis
        _async_redis = Redis.from_url(settings.redis_url, decode_responses=True)
    return _async_redis


async def _redis_set(key: str, value: str, ttl: int) -> None:
    try:
        await _get_async_redis().set(key, value, ex=ttl)
    except Exception as e:
        logger.warning(f"Redis cache_set failed: {e}")


async def _redis_get(key: str) -> Optional[str]:
    try:
        return await _get_async_redis().get(key)
    except Exception as e:
        logger.warning(f"Redis cache_get failed: {e}")
        return None


async def _redis_del(key: str) -> None:
    try:
        await _get_async_redis().delete(key)
    except Exception as e:
        logger.warning(f"Redis cache_del failed: {e}")