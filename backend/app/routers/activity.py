from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.workspace import Workspace, ChatMessage
from app.models.user import User
from datetime import datetime, timezone

router = APIRouter(prefix="/api", tags=["activity"])

@router.get("/activity")
async def get_activity(request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    result = await db.execute(
        select(Workspace).where(Workspace.user_id == user.id)
        .order_by(Workspace.last_active.desc())
        .limit(10)
    )
    workspaces = result.scalars().all()
    activity = []
    for ws in workspaces:
        status_map = {
            "pending": "started analysis",
            "cloning": "cloning repository",
            "analyzing": "analyzing code",
            "embedding": "indexing vectors",
            "generating_docs": "generating docs",
            "building_graph": "building dependency graph",
            "ready": "analysis ready",
            "error": "analysis failed",
        }
        label = status_map.get(ws.status, ws.status)
        activity.append({
            "type": "workspace",
            "text": f"{label}",
            "repo": f"{ws.repo_owner}/{ws.repo_name}",
            "workspace_id": ws.id,
            "timestamp": (ws.last_active or datetime.now(timezone.utc)).isoformat(),
        })
    chat_result = await db.execute(
        select(ChatMessage).where(
            ChatMessage.role == "assistant",
            ChatMessage.workspace_id.in_([w.id for w in workspaces])
        )
        .order_by(ChatMessage.created_at.desc())
        .limit(5)
    )
    for msg in chat_result.scalars().all():
        activity.append({
            "type": "chat",
            "text": "AI response generated",
            "workspace_id": msg.workspace_id,
            "timestamp": msg.created_at.isoformat(),
        })
    activity.sort(key=lambda a: a["timestamp"], reverse=True)
    return activity[:20]
