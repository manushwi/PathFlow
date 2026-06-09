from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.workspace import Workspace, WorkspaceFile
from app.models.user import User
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../shared'))
from constants import REPOS_BASE_PATH

router = APIRouter(prefix="/api/workspace/{workspace_id}/files", tags=["files"])

@router.get("")
async def get_file_tree(workspace_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    result = await db.execute(
        select(Workspace)
        .options(selectinload(Workspace.analysis))
        .where(Workspace.id == workspace_id, Workspace.user_id == user.id)
    )
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404)
    if ws.analysis and ws.analysis.file_tree:
        return {"tree": ws.analysis.file_tree}
    return {"tree": {}}

@router.get("/content")
async def get_file_content(workspace_id: int, path: str, request: Request,
                            db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id,
                                                        Workspace.user_id == user.id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404)
    repo_path = os.path.join(REPOS_BASE_PATH, str(workspace_id))
    file_path = os.path.join(repo_path, path.lstrip("/"))
    if not os.path.realpath(file_path).startswith(os.path.realpath(repo_path)):
        raise HTTPException(403, "Access denied")
    if not os.path.exists(file_path):
        raise HTTPException(404, "File not found")
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()
    return {"path": path, "content": content}

@router.post("/content")
async def save_file_content(workspace_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id,
                                                        Workspace.user_id == user.id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404)
    body = await request.json()
    path = body["path"]
    content = body["content"]
    repo_path = os.path.join(REPOS_BASE_PATH, str(workspace_id))
    file_path = os.path.join(repo_path, path.lstrip("/"))
    if not os.path.realpath(file_path).startswith(os.path.realpath(repo_path)):
        raise HTTPException(403, "Access denied")
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    return {"ok": True}

@router.post("/open-files")
async def save_open_files(workspace_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id,
                                                        Workspace.user_id == user.id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404)
    body = await request.json()
    open_files = body.get("files", [])
    existing = await db.execute(select(WorkspaceFile).where(WorkspaceFile.workspace_id == workspace_id))
    for wf in existing.scalars():
        await db.delete(wf)
    for f in open_files:
        db.add(WorkspaceFile(workspace_id=workspace_id, file_path=f["path"],
                             cursor_line=f.get("line", 0), cursor_col=f.get("col", 0)))
    await db.commit()
    return {"ok": True}

@router.get("/open-files")
async def get_open_files(workspace_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    result = await db.execute(select(WorkspaceFile).where(WorkspaceFile.workspace_id == workspace_id))
    files = result.scalars().all()
    return {"files": [{"path": f.file_path, "line": f.cursor_line, "col": f.cursor_col} for f in files]}
