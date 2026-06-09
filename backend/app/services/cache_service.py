import httpx
import json
from app.core.config import settings

BASE = settings.upstash_redis_rest_url
TOKEN = settings.upstash_redis_rest_token

async def cache_set(key: str, value: any, ttl: int = 3600):
    data = json.dumps(value)
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{BASE}/set/{key}",
            params={"EX": str(ttl)},
            headers={"Authorization": f"Bearer {TOKEN}"},
            content=data,
        )
        resp.raise_for_status()

async def cache_get(key: str) -> any:
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{BASE}/get/{key}",
                             headers={"Authorization": f"Bearer {TOKEN}"})
        result = r.json()
        if result.get("result"):
            return json.loads(result["result"])
    return None

async def cache_del(key: str):
    async with httpx.AsyncClient() as client:
        await client.post(f"{BASE}/del/{key}",
                          headers={"Authorization": f"Bearer {TOKEN}"})
