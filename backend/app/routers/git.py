from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.workspace import Workspace
from app.models.user import User
from app.services.github_service import create_pull_request
from app.services.ai_service import chat_complete_json
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../shared'))
from constants import REPOS_BASE_PATH
import git

router = APIRouter(prefix="/api/git", tags=["git"])

def get_repo(workspace_id: int) -> git.Repo:
    """Caller must verify workspace ownership via DB before calling this."""
    path = os.path.join(REPOS_BASE_PATH, str(workspace_id))
    if not os.path.exists(path):
        raise HTTPException(404, "Repository not found locally")
    return git.Repo(path)

@router.post("/branch")
async def create_branch(request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    body = await request.json()
    workspace_id = body["workspace_id"]
    branch_name = body["branch_name"]
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id,
                                                        Workspace.user_id == user.id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404)
    repo = get_repo(workspace_id)
    new_branch = repo.create_head(branch_name)
    new_branch.checkout()
    ws.branch = branch_name
    await db.commit()
    return {"branch": branch_name}

@router.get("/diff/{workspace_id}")
async def get_diff(workspace_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id,
                                                        Workspace.user_id == user.id))
    if not result.scalar_one_or_none():
        raise HTTPException(404)
    repo = get_repo(workspace_id)
    diff = repo.git.diff()
    staged = repo.git.diff("--staged")
    untracked = repo.untracked_files
    return {"diff": diff, "staged": staged, "untracked": untracked}

@router.post("/commit")
async def commit_changes(request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    body = await request.json()
    workspace_id = body["workspace_id"]
    message = body["message"]
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id,
                                                        Workspace.user_id == user.id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404)
    repo = get_repo(workspace_id)
    repo.git.add("-A")
    repo.index.commit(message)
    return {"sha": repo.head.commit.hexsha, "message": message}

@router.post("/pr/generate")
async def generate_pr(request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    body = await request.json()
    workspace_id = body["workspace_id"]
    issue_number = body.get("issue_number")
    diff_content = body.get("diff", "")
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id,
                                                        Workspace.user_id == user.id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404)
    prompt = f"""Generate a GitHub pull request for issue #{issue_number}.

Diff:
{diff_content[:2000]}

Return JSON:
{{"title": "concise PR title", "body": "markdown PR description with ## Summary, ## Changes, ## Testing sections"}}"""
    pr_content = await chat_complete_json([{"role": "user", "content": prompt}])
    return pr_content

@router.post("/pr/create")
async def submit_pr(request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    body = await request.json()
    workspace_id = body["workspace_id"]
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id,
                                                        Workspace.user_id == user.id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404)
    repo = get_repo(workspace_id)
    origin = repo.remote("origin")
    origin.set_url(ws.repo_url.replace("https://", f"https://x-access-token:{user.github_token}@"))
    origin.push(ws.branch)
    repo = get_repo(workspace_id)
    pr = await create_pull_request(user.github_token, ws.repo_owner, ws.repo_name,
                                    body["title"], body["body"], ws.branch, repo.active_branch.name)
    ws.status = "pr_submitted"
    await db.commit()
    return {"pr_url": pr.get("html_url"), "pr_number": pr.get("number")}
