import httpx
import json
from typing import AsyncGenerator
from app.core.config import settings

OPENROUTER_BASE = "https://openrouter.ai/api/v1"

async def get_embedding(text: str) -> list[float]:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            f"{OPENROUTER_BASE}/embeddings",
            headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
            json={"model": settings.openrouter_embed_model, "input": text},
        )
        return r.json()["data"][0]["embedding"]

async def get_embeddings(texts: list[str]) -> list[list[float]]:
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{OPENROUTER_BASE}/embeddings",
            headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
            json={"model": settings.openrouter_embed_model, "input": texts},
        )
        data = r.json()["data"]
        return [d["embedding"] for d in sorted(data, key=lambda x: x["index"])]

async def chat_complete(messages: list[dict], system: str = "") -> str:
    msgs = ([{"role": "system", "content": system}] if system else []) + messages
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            f"{OPENROUTER_BASE}/chat/completions",
            headers={"Authorization": f"Bearer {settings.openrouter_api_key}",
                     "HTTP-Referer": settings.app_url},
            json={"model": settings.openrouter_model, "messages": msgs},
        )
        data = r.json()
        if "error" in data:
            msg = data["error"].get("message", str(data["error"]))
            raise ValueError(f"OpenRouter API error: {msg}")
        if "choices" not in data or not data["choices"]:
            raise ValueError(f"OpenRouter returned no choices: {data}")
        return data["choices"][0]["message"]["content"]

async def chat_stream(messages: list[dict], system: str = "") -> AsyncGenerator[str, None]:
    msgs = ([{"role": "system", "content": system}] if system else []) + messages
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream(
            "POST",
            f"{OPENROUTER_BASE}/chat/completions",
            headers={"Authorization": f"Bearer {settings.openrouter_api_key}",
                     "HTTP-Referer": settings.app_url},
            json={"model": settings.openrouter_model, "messages": msgs, "stream": True},
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    chunk = line[6:]
                    if chunk == "[DONE]":
                        break
                    try:
                        data = json.loads(chunk)
                        delta = data["choices"][0]["delta"].get("content", "")
                        if delta:
                            yield delta
                    except Exception:
                        continue

async def chat_complete_json(messages: list[dict], system: str = "") -> dict:
    try:
        sys_prompt = (system or "") + "\n\nRespond ONLY with valid JSON. No markdown, no explanation."
        result = await chat_complete(messages, sys_prompt)
    except Exception as e:
        return {"error": f"AI call failed: {e}"}
    clean = result.strip()
    for prefix in ["```json", "```"]:
        if clean.startswith(prefix):
            clean = clean[len(prefix):]
    for suffix in ["```"]:
        if clean.endswith(suffix):
            clean = clean[:-len(suffix)]
    clean = clean.strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        return {"error": "Failed to parse AI response", "raw": clean[:500]}
