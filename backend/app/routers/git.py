from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.workspace import Workspace
from app.models.user import User
from app.schemas.requests import CommitRequest, CreateBranchRequest, GeneratePRRequest, CreatePRRequest, ManualBranchRequest
from app.services.github_service import create_pull_request, check_collab, fork_repo
from app.services.ai_service import chat_complete_json
import os, sys, tempfile, zipfile, shutil
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../shared'))
from constants import REPOS_BASE_PATH
import git

router = APIRouter(prefix="/api/git", tags=["git"])

def get_repo(workspace_id: int) -> git.Repo:
    path = os.path.join(REPOS_BASE_PATH, str(workspace_id))
    if not os.path.exists(path):
        raise HTTPException(404, "Repository not found locally")
    return git.Repo(path)

@router.post("/branch")
async def create_branch_endpoint(body: CreateBranchRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    workspace_id = body.workspace_id
    branch_name = body.name
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
async def commit_changes(body: CommitRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    workspace_id = body.workspace_id
    message = body.message
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
async def generate_pr(body: GeneratePRRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    workspace_id = body.workspace_id
    issue_number = body.issue_number
    diff_content = body.diff
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
async def submit_pr(body: CreatePRRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    workspace_id = body.workspace_id
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id,
                                                        Workspace.user_id == user.id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404)
    repo = get_repo(workspace_id)
    if repo.is_dirty(untracked_files=True):
        repo.git.add("-A")
        repo.index.commit("Auto-commit before PR")
    is_collab = await check_collab(user.github_token, ws.repo_owner, ws.repo_name, user.login)
    head_for_pr = ws.branch
    if is_collab:
        origin = repo.remote("origin")
        origin.set_url(ws.repo_url.replace("https://", f"https://x-access-token:{user.github_token}@"))
        try:
            origin.push(ws.branch)
        except git.GitCommandError as e:
            if "403" in str(e.stderr or ""):
                raise HTTPException(403, f"Push failed: your GitHub token doesn't have write access to {ws.repo_owner}/{ws.repo_name}. You need to be a collaborator on the repository.")
            raise HTTPException(500, f"Push failed: {e.stderr or e}")
    else:
        try:
            fork_data = await fork_repo(user.github_token, ws.repo_owner, ws.repo_name)
            fork_clone_url = fork_data.get("clone_url")
            if not fork_clone_url:
                raise HTTPException(500, "Fork failed — could not determine fork URL")
            fork_push_url = fork_clone_url.replace("https://", f"https://x-access-token:{user.github_token}@")
            repo.git.push(fork_push_url, ws.branch)
            head_for_pr = f"{user.login}:{ws.branch}"
        except Exception as e:
            raise HTTPException(500, f"Fork + push failed: {e}")
    repo = get_repo(workspace_id)
    pr = await create_pull_request(user.github_token, ws.repo_owner, ws.repo_name,
                                    body.title, body.body, head_for_pr, repo.active_branch.name)
    ws.status = "pr_submitted"
    await db.commit()
    return {"pr_url": pr.get("html_url"), "pr_number": pr.get("number")}


@router.post("/manual-branch")
async def create_manual_branch(body: ManualBranchRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    workspace_id = body.workspace_id
    issue_number = body.issue_number
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id,
                                                        Workspace.user_id == user.id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404)
    branch_name = f"fix/issue-{issue_number}-manual"
    repo = get_repo(workspace_id)
    existing = [h.name for h in repo.heads]
    if branch_name not in existing:
        new_branch = repo.create_head(branch_name)
        new_branch.checkout()
    else:
        repo.heads[branch_name].checkout()
    ws.branch = branch_name
    await db.commit()
    return {"branch": branch_name}


@router.get("/zip/{workspace_id}")
async def download_repo_zip(workspace_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id,
                                                        Workspace.user_id == user.id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404)
    repo_path = os.path.join(REPOS_BASE_PATH, str(workspace_id))
    if not os.path.exists(repo_path):
        raise HTTPException(404, "Repository not found locally")
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    tmp_path = tmp.name
    tmp.close()
    with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(repo_path):
            for f in files:
                abs_path = os.path.join(root, f)
                arcname = os.path.relpath(abs_path, repo_path)
                zf.write(abs_path, arcname)
    return FileResponse(
        tmp_path,
        media_type="application/zip",
        filename=f"{ws.repo_name}-{ws.branch}.zip",
        background=BackgroundTask(lambda: os.unlink(tmp_path)),
    )
