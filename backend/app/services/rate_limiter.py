import time
from collections import defaultdict
from fastapi import Request, HTTPException

_rate_store: dict[str, list[float]] = defaultdict(list)

def check_rate_limit(key: str, max_requests: int = 20, window_seconds: int = 60) -> None:
    now = time.time()
    timestamps = _rate_store[key]
    cutoff = now - window_seconds
    timestamps[:] = [t for t in timestamps if t > cutoff]
    if len(timestamps) >= max_requests:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")
    timestamps.append(now)

def get_client_key(request: Request) -> str:
    return request.cookies.get("session") or request.client.host if request.client else "unknown"