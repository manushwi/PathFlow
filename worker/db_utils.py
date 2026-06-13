from urllib.parse import urlparse, urlunparse
from sqlalchemy import create_engine
from app.core.config import settings

_engine = None

def get_sync_engine():
    global _engine
    if _engine is not None:
        return _engine
    url = settings.database_url
    parsed = urlparse(url)
    query = parsed.query
    if "sslmode" in query or "channel_binding" in query:
        clean_query = "&".join(
            p for p in query.split("&")
            if not p.startswith("sslmode") and not p.startswith("channel_binding")
        )
        url = urlunparse(parsed._replace(query=clean_query))
    url = url.replace("postgresql://", "postgresql+psycopg2://")
    _engine = create_engine(url, pool_pre_ping=True)
    return _engine
