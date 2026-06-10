from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.workspace import Workspace, RepoAnalysis
from app.models.user import User
import os, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../shared'))
from constants import REPOS_BASE_PATH

router = APIRouter(prefix="/api/workspace", tags=["workspace"])

def parse_repo_url(url: str) -> tuple[str, str]:
    match = re.search(r"github\.com/([^/]+)/([^/\s?#]+)", url)
    if not match:
        raise HTTPException(400, "Invalid GitHub repository URL")
    return match.group(1), match.group(2).removesuffix(".git")

@router.get("")
async def list_workspaces(request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    result = await db.execute(select(Workspace).where(Workspace.user_id == user.id)
                               .order_by(Workspace.last_active.desc()))
    workspaces = result.scalars().all()
    return [{"id": w.id, "repo_url": w.repo_url, "repo_owner": w.repo_owner,
             "repo_name": w.repo_name, "status": w.status, "branch": w.branch,
             "last_active": w.last_active} for w in workspaces]

@router.post("")
async def create_workspace(request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    from app.services.rate_limiter import check_rate_limit, get_client_key
    check_rate_limit(get_client_key(request), max_requests=5, window_seconds=60)
    body = await request.json()
    repo_url = body["repo_url"].strip()
    owner, name = parse_repo_url(repo_url)
    existing = await db.execute(
        select(Workspace).where(Workspace.user_id == user.id, Workspace.repo_name == name))
    ws = existing.scalar_one_or_none()
    if ws:
        return {"id": ws.id, "existing": True}
    ws = Workspace(user_id=user.id, repo_url=repo_url, repo_owner=owner,
                   repo_name=name, status="pending")
    db.add(ws)
    await db.commit()
    await db.refresh(ws)
    from app.core.config import settings
    try:
        from worker.tasks.pipeline import run_analysis_pipeline
        run_analysis_pipeline(ws.id, repo_url, "main")
    except Exception:
        ws.status = "error"
        await db.commit()
    return {"id": ws.id, "existing": False}

@router.get("/{workspace_id}")
async def get_workspace(workspace_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    result = await db.execute(
        select(Workspace)
        .options(selectinload(Workspace.analysis))
        .where(Workspace.id == workspace_id, Workspace.user_id == user.id)
    )
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404, "Workspace not found")
    analysis = None
    if ws.analysis:
        analysis = {"tech_stack": ws.analysis.tech_stack, "docs_json": ws.analysis.docs_json,
                    "graph_json": ws.analysis.graph_json, "file_tree": ws.analysis.file_tree}
    return {"id": ws.id, "repo_url": ws.repo_url, "repo_owner": ws.repo_owner,
            "repo_name": ws.repo_name, "status": ws.status, "branch": ws.branch,
            "analysis": analysis, "last_active": ws.last_active}

@router.get("/{workspace_id}/status")
async def get_status(workspace_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id,
                                                        Workspace.user_id == user.id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404)
    return {"status": ws.status}

@router.delete("/{workspace_id}")
async def delete_workspace(workspace_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id,
                                                        Workspace.user_id == user.id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404)
    # Clean up Qdrant vectors
    try:
        from app.services.vector_service import delete_workspace_vectors
        await delete_workspace_vectors(workspace_id)
    except Exception:
        pass
    # Clean up local repo files
    import shutil
    repo_path = os.path.join(REPOS_BASE_PATH, str(workspace_id))
    if os.path.exists(repo_path):
        shutil.rmtree(repo_path, ignore_errors=True)
    await db.delete(ws)
    await db.commit()
    return {"ok": True}
