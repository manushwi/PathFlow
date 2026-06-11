from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.workspace import Workspace
from app.models.user import User
from app.schemas.requests import TerminalExecRequest
from app.services.rate_limiter import check_rate_limit, get_client_key
import asyncio, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../shared'))
from constants import REPOS_BASE_PATH

router = APIRouter(prefix="/api/terminal", tags=["terminal"])

ALLOWED_COMMANDS = {"git", "ls", "cat", "pwd", "echo", "cd", "mkdir", "touch", "cp", "mv", "rm", "head", "tail", "wc", "find", "grep", "node", "python", "npm", "npx", "yarn", "pnpm", "cargo", "go", "rustc", "make", "curl", "wget", "jq", "sed", "awk"}

@router.post("/exec")
async def terminal_exec(body: TerminalExecRequest, request: Request, db: AsyncSession = Depends(get_db)):
    check_rate_limit(get_client_key(request), max_requests=30, window_seconds=60)
    user: User = await get_current_user(request, db)
    workspace_id = body.workspace_id
    command = body.command.strip()
    if not workspace_id or not command:
        raise HTTPException(400, "workspace_id and command are required")
    cmd_base = command.split()[0].lower() if command.split() else ""
    if cmd_base not in ALLOWED_COMMANDS:
        raise HTTPException(400, f"Command '{cmd_base}' is not allowed")
    result = await db.execute(select(Workspace).where(
        Workspace.id == workspace_id, Workspace.user_id == user.id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404, "Workspace not found")
    repo_path = os.path.join(REPOS_BASE_PATH, str(workspace_id))
    if not os.path.isdir(repo_path):
        raise HTTPException(400, "Repository directory not found")
    try:
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=repo_path,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
        except asyncio.TimeoutError:
            proc.kill()
            return {"stdout": "", "stderr": "Command timed out after 30s", "exit_code": -1}
        return {
            "stdout": stdout.decode("utf-8", errors="replace") if stdout else "",
            "stderr": stderr.decode("utf-8", errors="replace") if stderr else "",
            "exit_code": proc.returncode,
        }
    except Exception as e:
        return {"stdout": "", "stderr": str(e), "exit_code": -1}
