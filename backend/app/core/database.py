from urllib.parse import urlparse, urlunparse
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

class Base(DeclarativeBase):
    pass

_engine = None
_AsyncSessionLocal = None

def _get_engine():
    global _engine, _AsyncSessionLocal
    if _engine is None:
        db_url = settings.database_url
        parsed = urlparse(db_url)
        query = parsed.query
        if "sslmode" in query or "channel_binding" in query:
            clean_query = "&".join(
                p for p in query.split("&")
                if not p.startswith("sslmode") and not p.startswith("channel_binding")
            )
            db_url = urlunparse(parsed._replace(query=clean_query))
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")
        if "ssl" not in db_url:
            db_url += "&ssl=require" if "?" in db_url else "?ssl=require"
        _engine = create_async_engine(db_url, echo=False, pool_pre_ping=True)
        _AsyncSessionLocal = async_sessionmaker(_engine, expire_on_commit=False)
    return _engine, _AsyncSessionLocal

async def get_db() -> AsyncSession:
    _, session_local = _get_engine()
    async with session_local() as session:
        yield session
