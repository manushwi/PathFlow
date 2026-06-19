from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.workspace import Workspace, WorkspaceFile
from app.models.user import User
from app.schemas.requests import SaveFileRequest, SaveOpenFilesRequest, CreateFileRequest, DeleteFileRequest
import os, sys, shutil
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../shared'))
from constants import REPOS_BASE_PATH

router = APIRouter(prefix="/api/workspace/{workspace_id}/files", tags=["files"])

SKIP_DIRS = {".git", "__pycache__", "node_modules", ".venv", "venv", ".next", "dist", "build", ".idea", ".vscode"}

def build_file_tree(repo_path: str) -> dict:
    tree: dict = {}
    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        rel_root = os.path.relpath(root, repo_path)
        if rel_root == ".":
            node = tree
        else:
            node = tree
            for part in rel_root.replace("\\", "/").split("/"):
                node = node.setdefault(part, {})
        for fname in files:
            fpath = os.path.join(root, fname)
            try:
                size = os.path.getsize(fpath)
            except OSError:
                size = 0
            ext = os.path.splitext(fname)[1].lower()
            node[fname] = {"type": "file", "size": size, "ext": ext}
    return tree

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
    repo_path = os.path.join(REPOS_BASE_PATH, str(workspace_id))
    if os.path.isdir(repo_path):
        tree = build_file_tree(repo_path)
        return {"tree": tree}
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
async def save_file_content(workspace_id: int, body: SaveFileRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id,
                                                        Workspace.user_id == user.id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404)
    path = body.path
    content = body.content
    repo_path = os.path.join(REPOS_BASE_PATH, str(workspace_id))
    file_path = os.path.join(repo_path, path.lstrip("/"))
    if not os.path.realpath(file_path).startswith(os.path.realpath(repo_path)):
        raise HTTPException(403, "Access denied")
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    return {"ok": True}

@router.post("/open-files")
async def save_open_files(workspace_id: int, body: SaveOpenFilesRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id,
                                                        Workspace.user_id == user.id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404)
    open_files = body.files
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

@router.post("/create")
async def create_file_or_folder(workspace_id: int, body: CreateFileRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id,
                                                        Workspace.user_id == user.id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404)
    repo_path = os.path.join(REPOS_BASE_PATH, str(workspace_id))
    target = os.path.join(repo_path, body.path.lstrip("/"))
    if not os.path.realpath(target).startswith(os.path.realpath(repo_path)):
        raise HTTPException(403, "Access denied")
    if os.path.exists(target):
        raise HTTPException(409, f"{body.path} already exists")
    if body.type == "folder":
        os.makedirs(target, exist_ok=True)
    else:
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, "w") as f:
            f.write("")
    return {"ok": True, "path": body.path}

@router.delete("/delete")
async def delete_file_or_folder(workspace_id: int, body: DeleteFileRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id,
                                                        Workspace.user_id == user.id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404)
    repo_path = os.path.join(REPOS_BASE_PATH, str(workspace_id))
    target = os.path.join(repo_path, body.path.lstrip("/"))
    if not os.path.realpath(target).startswith(os.path.realpath(repo_path)):
        raise HTTPException(403, "Access denied")
    if not os.path.exists(target):
        raise HTTPException(404, f"{body.path} not found")
    if os.path.isdir(target):
        shutil.rmtree(target)
    else:
        os.remove(target)
    return {"ok": True}
