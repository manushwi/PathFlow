from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import StreamingResponse
from app.services.rate_limiter import check_rate_limit, get_client_key
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.workspace import Workspace, RepoAnalysis, ChatMessage
from app.models.user import User
from app.services.ai_service import chat_stream, get_embedding, chat_complete_json
from app.services.vector_service import search_similar
from app.schemas.requests import ChatRequest, SolveIssueRequest, SolveAndPRRequest, UpdatePRRequest
from app.services.github_service import create_pull_request, check_collab, fork_repo, get_repo_issues, get_pr, get_pr_reviews, get_pr_issue_comments
from shared.prompts import build_chat_prompt, SYSTEM_AI_SOLVER, SYSTEM_PR_UPDATER
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../shared'))
from constants import REPOS_BASE_PATH
import git

router = APIRouter(prefix="/api/ai", tags=["ai"])

SKIP_DIRS = {".git", "__pycache__", "node_modules", ".venv", "venv", ".next", "dist", "build", ".idea", ".vscode"}

def get_repo_file_list(repo_path: str) -> list[str]:
    files = []
    for root, dirs, fnames in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        rel_root = os.path.relpath(root, repo_path)
        for f in fnames:
            files.append(os.path.join(rel_root, f).replace("\\", "/"))
    return sorted(files)

@router.post("/chat")
async def stream_chat(body: ChatRequest, request: Request, db: AsyncSession = Depends(get_db)):
    check_rate_limit(get_client_key(request), max_requests=30, window_seconds=60)
    user: User = await get_current_user(request, db)
    workspace_id = body.workspace_id
    message = body.message
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id,
                                                        Workspace.user_id == user.id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404)
    hist_result = await db.execute(select(ChatMessage).where(ChatMessage.workspace_id == workspace_id)
                                   .order_by(ChatMessage.created_at.desc()).limit(10))
    history = [{"role": m.role, "content": m.content} for m in reversed(hist_result.scalars().all())]
    query_emb = await get_embedding(message[:500])
    context_chunks = await search_similar(workspace_id, query_emb, limit=6)
    analysis_result = await db.execute(select(RepoAnalysis).where(RepoAnalysis.workspace_id == workspace_id))
    analysis = analysis_result.scalar_one_or_none()
    workspace_info = {"repo_name": ws.repo_name,
                      "framework": (analysis.docs_json or {}).get("framework", "") if analysis else ""}
    messages = build_chat_prompt(message, context_chunks, history, workspace_info)
    db.add(ChatMessage(workspace_id=workspace_id, role="user", content=message))
    await db.commit()
    async def generate():
        system = messages[0]["content"] if messages and messages[0]["role"] == "system" else ""
        chat_msgs = [m for m in messages if m["role"] != "system"] if messages else []
        full_text = ""
        async for chunk in chat_stream(chat_msgs, system):
            full_text += chunk
            yield f"data: {json.dumps({'text': chunk})}\n\n"
        db.add(ChatMessage(workspace_id=workspace_id, role="assistant", content=full_text))
        await db.commit()
        yield f"data: {json.dumps({'done': True})}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@router.get("/chat/{workspace_id}/history")
async def get_chat_history(workspace_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    result = await db.execute(select(ChatMessage).where(ChatMessage.workspace_id == workspace_id)
                               .order_by(ChatMessage.created_at))
    messages = result.scalars().all()
    return {"messages": [{"role": m.role, "content": m.content,
                          "created_at": m.created_at} for m in messages]}

@router.post("/solve-issue")
async def solve_issue(body: SolveIssueRequest, request: Request, db: AsyncSession = Depends(get_db)):
    check_rate_limit(get_client_key(request), max_requests=10, window_seconds=60)
    user: User = await get_current_user(request, db)
    workspace_id = body.workspace_id
    issue_number = body.issue_number
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id,
                                                        Workspace.user_id == user.id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404)
    from app.services.github_service import get_repo_issues
    raw_issues = await get_repo_issues(user.github_token, ws.repo_owner, ws.repo_name)
    issue = next((i for i in raw_issues if i["number"] == issue_number), None)
    if not issue:
        raise HTTPException(404)
    query_emb = await get_embedding(f"{issue['title']} {(issue.get('body') or '')[:400]}")
    context_chunks = await search_similar(workspace_id, query_emb, limit=10)
    analysis_result = await db.execute(select(RepoAnalysis).where(RepoAnalysis.workspace_id == workspace_id))
    analysis = analysis_result.scalar_one_or_none()
    docs = analysis.docs_json if analysis else {}
    context_str = "\n\n".join([f"// {c['file_path']}\n{c['content'][:600]}" for c in context_chunks])
    prompt = f"""Fix this GitHub issue:

Issue #{issue['number']}: {issue['title']}
{issue.get('body', '')[:800]}

Relevant code:
{context_str}

Return JSON:
{{
  "plan": ["step 1", "step 2"],
  "files_to_change": [
    {{
      "path": "relative/path.py",
      "description": "what to change",
      "diff": "unified diff format showing the change"
    }}
  ],
  "explanation": "overall approach"
}}"""
    solution = await chat_complete_json([{"role": "user", "content": prompt}], SYSTEM_AI_SOLVER)
    return solution


@router.post("/solve-and-pr")
async def solve_issue_and_pr(body: SolveAndPRRequest, request: Request, db: AsyncSession = Depends(get_db)):
    check_rate_limit(get_client_key(request), max_requests=5, window_seconds=120)
    user: User = await get_current_user(request, db)
    workspace_id = body.workspace_id
    issue_number = body.issue_number
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id,
                                                        Workspace.user_id == user.id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404)
    raw_issues = await get_repo_issues(user.github_token, ws.repo_owner, ws.repo_name)
    issue = next((i for i in raw_issues if i["number"] == issue_number), None)
    if not issue:
        raise HTTPException(404)
    # Check push permissions — fork if needed
    is_collab = await check_collab(user.github_token, ws.repo_owner, ws.repo_name, user.login)
    # 1. Create and checkout branch
    branch_name = f"fix/issue-{issue_number}"
    repo_path = os.path.join(REPOS_BASE_PATH, str(workspace_id))
    if not os.path.exists(repo_path):
        raise HTTPException(400, "Repository not cloned yet")
    repo = git.Repo(repo_path)
    existing = [h.name for h in repo.heads]
    if branch_name in existing:
        repo.heads[branch_name].checkout()
    else:
        new_branch = repo.create_head(branch_name)
        new_branch.checkout()
    ws.branch = branch_name
    await db.commit()
    # 2. Get AI solution
    query_emb = await get_embedding(f"{issue['title']} {(issue.get('body') or '')[:400]}")
    context_chunks = await search_similar(workspace_id, query_emb, limit=20)
    analysis_result = await db.execute(select(RepoAnalysis).where(RepoAnalysis.workspace_id == workspace_id))
    analysis = analysis_result.scalar_one_or_none()
    docs = analysis.docs_json if analysis else {}
    context_str = "\n\n".join([f"// {c['file_path']}\n{c['content'][:800]}" for c in context_chunks])
    file_list = get_repo_file_list(repo_path)
    repo_overview = docs.get("overview", "")
    tree_str = "\n".join(file_list[:200])
    prompt = f"""Fix this GitHub issue. Make ONLY the targeted changes needed to resolve the issue — preserve all existing comments, docstrings, README content, and unrelated code.

Issue #{issue['number']}: {issue['title']}
{issue.get('body', '')[:1000]}

Repo overview: {repo_overview}

Repository file structure:
{tree_str}

Relevant code snippets:
{context_str}

Return JSON:
{{
  "plan": ["step 1", "step 2"],
  "files_to_change": [
    {{
      "path": "relative/path.py",
      "description": "what to change",
      "edits": [
        {{
          "search": "exact existing lines of code to find (must be unique in the file)",
          "replace": "new code to substitute in place of search"
        }}
      ]
    }}
  ],
  "explanation": "overall approach (2-3 sentences)",
  "commit_message": "descriptive conventional commit message explaining what was fixed",
  "pr_title": "short descriptive PR title (max 72 chars)",
  "pr_body": "markdown PR body with ## Summary, ## Changes, ## Related Files sections"
}}"""
    solution = await chat_complete_json([{"role": "user", "content": prompt}], SYSTEM_AI_SOLVER)
    if not solution or "files_to_change" not in solution:
        return {"error": "AI failed to produce a valid solution", "solution": solution}
    # 3. Apply targeted edits (search/replace)
    files_changed = []
    for fc in solution.get("files_to_change", []):
        edits = fc.get("edits", [])
        if not edits:
            continue
        file_path = os.path.join(repo_path, fc["path"].lstrip("/"))
        is_new = not os.path.exists(file_path)
        if is_new:
            content = ""
        else:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
        applied = 0
        for edit in edits:
            search = edit.get("search", "")
            replace = edit.get("replace", "")
            if not search and is_new:
                content = replace
                applied += 1
                continue
            if not search:
                continue
            idx = content.find(search)
            if idx == -1:
                continue
            content = content[:idx] + replace + content[idx + len(search):]
            applied += 1
        if applied:
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            files_changed.append(fc["path"])
    if not files_changed:
        return {"error": "AI failed to produce any file changes", "files_changed": []}
    # 4. Commit
    if not repo.is_dirty(untracked_files=True):
        return {"error": "No changes to commit after applying solution", "files_changed": files_changed}
    commit_msg = solution.get("commit_message", f"Fix issue #{issue_number}: {issue['title'][:60]}")
    repo.git.add("-A")
    repo.index.commit(commit_msg)
    # 5. Push
    push_success = False
    head_for_pr = branch_name
    if is_collab:
        try:
            origin = repo.remote("origin")
            push_url = ws.repo_url.replace("https://", f"https://x-access-token:{user.github_token}@")
            origin.set_url(push_url)
            origin.push(branch_name)
            push_success = True
        except git.GitCommandError as e:
            if "403" in str(e.stderr or ""):
                return {"error": f"Push failed: your GitHub token doesn't have write access to {ws.repo_owner}/{ws.repo_name}. You need to be a collaborator on the repository.", "branch": branch_name, "files_changed": files_changed}
            repo.git.push("origin", branch_name, force=True)
            push_success = True
    else:
        try:
            fork_data = await fork_repo(user.github_token, ws.repo_owner, ws.repo_name)
            fork_clone_url = fork_data.get("clone_url")
            if not fork_clone_url:
                return {"error": "Fork failed — could not determine fork URL", "branch": branch_name, "files_changed": files_changed}
            fork_push_url = fork_clone_url.replace("https://", f"https://x-access-token:{user.github_token}@")
            try:
                repo.git.push(fork_push_url, branch_name)
            except Exception:
                repo.git.push(fork_push_url, branch_name, force=True)
            head_for_pr = f"{user.login}:{branch_name}"
            ws.fork_url = fork_clone_url
            push_success = True
        except Exception as e:
            return {"error": f"Fork + push failed: {e}", "branch": branch_name, "files_changed": files_changed}
    # 6. Create PR
    pr_title = solution.get("pr_title", solution.get("commit_message", f"Fix issue #{issue_number}: {issue['title'][:72]}"))
    pr_body = solution.get("pr_body", f"## Summary\n{issue.get('body', '')[:500]}\n\n## Changes\n{solution.get('explanation', '')}\n\n## Plan\n" + "\n".join(f"- {s}" for s in solution.get("plan", [])))
    try:
        pr = await create_pull_request(
            user.github_token, ws.repo_owner, ws.repo_name,
            pr_title, pr_body, head_for_pr, "main"
        )
        pr_url = pr.get("html_url", "")
        pr_number = pr.get("number", 0)
        ws.pr_number = pr_number
    except Exception as e:
        return {"error": f"PR creation failed: {e}", "branch": branch_name, "files_changed": files_changed}
    ws.status = "pr_submitted"
    await db.commit()
    return {
        "pr_url": pr_url,
        "pr_number": pr_number,
        "branch": branch_name,
        "files_changed": files_changed,
    }


@router.post("/update-pr")
async def update_pr(body: UpdatePRRequest, request: Request, db: AsyncSession = Depends(get_db)):
    check_rate_limit(get_client_key(request), max_requests=5, window_seconds=120)
    user: User = await get_current_user(request, db)
    workspace_id = body.workspace_id
    pr_number = body.pr_number
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id,
                                                        Workspace.user_id == user.id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404)
    # 1. Fetch PR details from GitHub
    pr_data = await get_pr(user.github_token, ws.repo_owner, ws.repo_name, pr_number)
    if "number" not in pr_data or pr_data.get("state") == "closed":
        return {"error": "PR not found or already closed"}
    head_branch = pr_data.get("head", {}).get("ref", "")
    base_branch = pr_data.get("base", {}).get("ref", "main")
    if not head_branch:
        return {"error": "Could not determine PR head branch"}
    # 2. Check out the PR branch locally
    repo_path = os.path.join(REPOS_BASE_PATH, str(workspace_id))
    if not os.path.exists(repo_path):
        return {"error": "Repository not cloned locally"}
    repo = git.Repo(repo_path)
    # Fetch latest from remote
    try:
        repo.remotes.origin.fetch()
    except Exception:
        pass
    # Checkout the branch
    if head_branch in [h.name for h in repo.heads]:
        repo.heads[head_branch].checkout()
    else:
        try:
            repo.git.checkout(head_branch)
        except git.GitCommandError:
            return {"error": f"Branch '{head_branch}' not found locally. The PR branch may have been deleted or the repo was re-cloned."}
    ws.branch = head_branch
    # 3. Merge base branch into PR branch to resolve any conflicts
    try:
        repo.git.merge(base_branch, "--no-edit", "--no-ff")
    except git.GitCommandError:
        pass
    # 4. Fetch review comments from GitHub
    review_comments = await get_pr_reviews(user.github_token, ws.repo_owner, ws.repo_name, pr_number)
    issue_comments = await get_pr_issue_comments(user.github_token, ws.repo_owner, ws.repo_name, pr_number)
    if not review_comments and not issue_comments:
        return {"error": "No review comments found on this PR. The moderator may have left feedback outside of GitHub reviews."}
    # 5. Get current branch diff (what was already done)
    current_diff = repo.git.diff(f"{base_branch}...{head_branch}") or repo.git.diff(f"origin/{base_branch}...")
    # 6. Get RAG context for relevant code
    all_feedback = []
    for rc in review_comments:
        all_feedback.append({
            "type": "inline_review",
            "file": rc.get("path", ""),
            "line": rc.get("line", rc.get("position", 0)),
            "body": rc.get("body", ""),
        })
    for ic in issue_comments:
        all_feedback.append({
            "type": "pr_comment",
            "body": ic.get("body", ""),
            "author": ic.get("user", {}).get("login", "unknown"),
        })
    # Build a combined feedback string
    feedback_lines = []
    for fb in all_feedback:
        if fb["type"] == "inline_review":
            feedback_lines.append(f"Inline review on {fb['file']}:{fb['line']}: {fb['body']}")
        else:
            feedback_lines.append(f"PR comment by {fb.get('author', 'reviewer')}: {fb['body']}")
    feedback_str = "\n\n".join(feedback_lines)
    # 7. Get relevant code context via RAG
    query_text = feedback_str[:500]
    query_emb = await get_embedding(query_text)
    context_chunks = await search_similar(workspace_id, query_emb, limit=20)
    analysis_result = await db.execute(select(RepoAnalysis).where(RepoAnalysis.workspace_id == workspace_id))
    analysis = analysis_result.scalar_one_or_none()
    context_str = "\n\n".join([f"// {c['file_path']}\n{c['content'][:800]}" for c in context_chunks])
    file_list = get_repo_file_list(repo_path)
    tree_str = "\n".join(file_list[:200])
    # 8. Call AI to generate updated solution
    prompt = f"""A pull request you created is being reviewed and the reviewer has requested changes.

PR #{pr_number} in {ws.repo_owner}/{ws.repo_name}
Branch: {head_branch} (base: {base_branch})

Current diff of what the PR changes:
{current_diff[:3000]}

Repository file structure:
{tree_str}

Relevant code snippets:
{context_str}

Review feedback to address:
{feedback_str}

Address ALL the review feedback above. Make ONLY the changes requested — do not add unrelated features or refactoring."""
    solution = await chat_complete_json([{"role": "user", "content": prompt}], SYSTEM_PR_UPDATER)
    if not solution or "files_to_change" not in solution:
        return {"error": "AI failed to produce a valid solution", "solution": solution}
    # 9. Apply targeted edits (same logic as solve-and-pr)
    files_changed = []
    for fc in solution.get("files_to_change", []):
        edits = fc.get("edits", [])
        if not edits:
            continue
        file_path = os.path.join(repo_path, fc["path"].lstrip("/"))
        is_new = not os.path.exists(file_path)
        if is_new:
            content = ""
        else:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
        applied = 0
        for edit in edits:
            search = edit.get("search", "")
            replace = edit.get("replace", "")
            if not search and is_new:
                content = replace
                applied += 1
                continue
            if not search:
                continue
            idx = content.find(search)
            if idx == -1:
                continue
            content = content[:idx] + replace + content[idx + len(search):]
            applied += 1
        if applied:
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            files_changed.append(fc["path"])
    if not files_changed:
        return {"error": "No file changes were applied. The AI may have failed to match existing code exactly.", "files_changed": []}
    # 10. Commit
    if not repo.is_dirty(untracked_files=True):
        return {"error": "No changes to commit after applying solution", "files_changed": files_changed}
    commit_msg = solution.get("commit_message", f"Address review feedback for PR #{pr_number}")
    repo.git.add("-A")
    repo.index.commit(commit_msg)
    # 11. Push to the same PR branch
    is_collab = await check_collab(user.github_token, ws.repo_owner, ws.repo_name, user.login)
    push_success = False
    if is_collab:
        try:
            origin = repo.remote("origin")
            push_url = ws.repo_url.replace("https://", f"https://x-access-token:{user.github_token}@")
            origin.set_url(push_url)
            origin.push(head_branch)
            push_success = True
        except git.GitCommandError as e:
            if "403" in str(e.stderr or ""):
                return {"error": f"Push failed: your GitHub token doesn't have write access.", "branch": head_branch, "files_changed": files_changed}
            repo.git.push("origin", head_branch, force=True)
            push_success = True
    else:
        fork_push_url = None
        if ws.fork_url:
            fork_push_url = ws.fork_url.replace("https://", f"https://x-access-token:{user.github_token}@")
        else:
            try:
                fork_data = await fork_repo(user.github_token, ws.repo_owner, ws.repo_name)
                fork_clone_url = fork_data.get("clone_url")
                if fork_clone_url:
                    ws.fork_url = fork_clone_url
                    fork_push_url = fork_clone_url.replace("https://", f"https://x-access-token:{user.github_token}@")
            except Exception:
                pass
        if not fork_push_url:
            return {"error": "Could not determine fork URL to push. You may not have push access to this PR.", "branch": head_branch, "files_changed": files_changed}
        try:
            repo.git.push(fork_push_url, head_branch)
            push_success = True
        except Exception:
            try:
                repo.git.push(fork_push_url, head_branch, force=True)
                push_success = True
            except Exception as e:
                return {"error": f"Fork push failed: {e}", "branch": head_branch, "files_changed": files_changed}
    if not push_success:
        return {"error": "Push failed for unknown reasons", "branch": head_branch, "files_changed": files_changed}
    ws.status = "pr_updated"
    await db.commit()
    return {
        "message": f"PR #{pr_number} updated successfully with {len(files_changed)} file(s) changed.",
        "commit_message": commit_msg,
        "branch": head_branch,
        "files_changed": files_changed,
        "pr_number": pr_number,
    }
