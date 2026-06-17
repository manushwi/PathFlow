import asyncio
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
            result = json.loads(raw)
            logger.info(f"Cache HIT: {key}")
            return result
        except Exception:
            logger.info(f"Cache HIT (corrupt): {key}")
            return None
    logger.info(f"Cache MISS: {key}")
    return None


async def cache_del(key: str) -> None:
    if settings.upstash_redis_rest_url and settings.upstash_redis_rest_token:
        await _upstash_del(key)
    else:
        await _redis_del(key)


async def cache_del_pattern(pattern: str) -> None:
    if settings.upstash_redis_rest_url and settings.upstash_redis_rest_token:
        await _upstash_del_pattern(pattern)
    else:
        await _redis_del_pattern(pattern)


# ── Upstash REST backend (sync via asyncio.to_thread to avoid Windows DNS bug) ──

def _upstash_post(url: str) -> None:
    import httpx
    httpx.post(url, headers={"Authorization": f"Bearer {settings.upstash_redis_rest_token}"}, timeout=10)


def _upstash_get_raw(url: str) -> Optional[str]:
    import httpx
    r = httpx.get(url, headers={"Authorization": f"Bearer {settings.upstash_redis_rest_token}"}, timeout=10)
    return r.json().get("result")


async def _upstash_set(key: str, value: str, ttl: int) -> None:
    import urllib.parse
    encoded = urllib.parse.quote(value, safe="")
    url = f"{settings.upstash_redis_rest_url}/set/{key}/{encoded}/EX/{ttl}"
    try:
        await asyncio.to_thread(_upstash_post, url)
    except Exception as e:
        logger.warning(f"Upstash cache_set failed: {e}")


async def _upstash_get(key: str) -> Optional[str]:
    url = f"{settings.upstash_redis_rest_url}/get/{key}"
    try:
        return await asyncio.to_thread(_upstash_get_raw, url)
    except Exception as e:
        logger.warning(f"Upstash cache_get failed: {e}")
        return None


async def _upstash_del(key: str) -> None:
    url = f"{settings.upstash_redis_rest_url}/del/{key}"
    try:
        await asyncio.to_thread(_upstash_post, url)
    except Exception as e:
        logger.warning(f"Upstash cache_del failed: {e}")


async def _upstash_del_pattern(pattern: str) -> None:
    # Upstash REST API does not support DEL by pattern natively
    # Fetch matching keys via GET /keys/{pattern} then DEL each
    list_url = f"{settings.upstash_redis_rest_url}/keys/{pattern}"
    try:
        def list_keys():
            import httpx
            r = httpx.get(list_url, headers={"Authorization": f"Bearer {settings.upstash_redis_rest_token}"}, timeout=10)
            return r.json().get("result", [])
        keys = await asyncio.to_thread(list_keys)
        if keys:
            for k in keys:
                await _upstash_del(k)
    except Exception as e:
        logger.warning(f"Upstash cache_del_pattern failed: {e}")


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


async def _redis_del_pattern(pattern: str) -> None:
    try:
        r = _get_async_redis()
        cursor = 0
        while True:
            cursor, keys = await r.scan(cursor=cursor, match=pattern, count=1000)
            if keys:
                await r.delete(*keys)
            if cursor == 0:
                break
    except Exception as e:
        logger.warning(f"Redis cache_del_pattern failed: {e}")


# ── Sync variants for use in Celery workers ──────────────────────────────────

_sync_redis = None

def _get_sync_redis():
    global _sync_redis
    if _sync_redis is None:
        from redis import Redis
        _sync_redis = Redis.from_url(settings.redis_url, decode_responses=True)
    return _sync_redis


def _sync_upstash_set(key: str, value: str, ttl: int) -> None:
    import httpx
    import urllib.parse
    encoded = urllib.parse.quote(value, safe="")
    url = f"{settings.upstash_redis_rest_url}/set/{key}/{encoded}/EX/{ttl}"
    try:
        httpx.post(url, headers={"Authorization": f"Bearer {settings.upstash_redis_rest_token}"}, timeout=10)
    except Exception as e:
        logger.warning(f"Upstash sync set failed: {e}")


def _sync_upstash_get(key: str) -> Optional[str]:
    import httpx
    url = f"{settings.upstash_redis_rest_url}/get/{key}"
    try:
        r = httpx.get(url, headers={"Authorization": f"Bearer {settings.upstash_redis_rest_token}"}, timeout=10)
        return r.json().get("result")
    except Exception as e:
        logger.warning(f"Upstash sync get failed: {e}")
        return None


def sync_cache_get(key: str) -> Optional[Any]:
    if settings.upstash_redis_rest_url and settings.upstash_redis_rest_token:
        raw = _sync_upstash_get(key)
    else:
        try:
            r = _get_sync_redis()
            raw = r.get(key)
        except Exception as e:
            logger.warning(f"sync_cache_get failed: {e}")
            raw = None
    if raw is not None:
        logger.info(f"Cache HIT: {key}")
        try:
            return json.loads(raw)
        except Exception:
            return raw
    logger.info(f"Cache MISS: {key}")
    return None


def sync_cache_set(key: str, value: Any, ttl: int = 3600) -> None:
    data = json.dumps(value)
    if settings.upstash_redis_rest_url and settings.upstash_redis_rest_token:
        _sync_upstash_set(key, data, ttl)
    else:
        try:
            r = _get_sync_redis()
            r.set(key, data, ex=ttl)
        except Exception as e:
            logger.warning(f"sync_cache_set failed: {e}")