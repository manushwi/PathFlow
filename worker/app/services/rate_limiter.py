import time
import json
import logging
from fastapi import Request, HTTPException
from app.core.config import settings

logger = logging.getLogger(__name__)

# Try to use Redis for shared rate limiting across workers.
# Falls back to in-memory if Redis is unavailable (dev environments).
_redis_client = None
_memory_store: dict = {}

def _get_redis():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis
        client = redis.Redis.from_url(settings.redis_url, socket_connect_timeout=1)
        client.ping()
        _redis_client = client
        return _redis_client
    except Exception:
        return None


def check_rate_limit(key: str, max_requests: int = 20, window_seconds: int = 60) -> None:
    r = _get_redis()
    if r:
        # Redis sliding window: store list of timestamps in a sorted set
        try:
            now = time.time()
            pipe = r.pipeline()
            rkey = f"rl:{key}"
            pipe.zremrangebyscore(rkey, 0, now - window_seconds)
            pipe.zcard(rkey)
            pipe.zadd(rkey, {str(now): now})
            pipe.expire(rkey, window_seconds + 5)
            results = pipe.execute()
            count = results[1]  # count BEFORE adding new request
            if count >= max_requests:
                raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")
            return
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Redis rate limit check failed, falling back to memory: {e}")

    # In-memory fallback (single process only)
    now = time.time()
    timestamps = _memory_store.setdefault(key, [])
    cutoff = now - window_seconds
    _memory_store[key] = [t for t in timestamps if t > cutoff]
    if len(_memory_store[key]) >= max_requests:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")
    _memory_store[key].append(now)


def get_client_key(request: Request) -> str:
    session = request.cookies.get("session")
    if session:
        return f"sess:{session[:16]}"  # use prefix of token, not full token
    return f"ip:{request.client.host}" if request.client else "unknown"