from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.workspace import Workspace, RepoAnalysis
from app.models.issue import Issue
from app.models.user import User
from app.services.github_service import get_repo_issues
from app.services.cache_service import cache_get, cache_set
from shared.prompts import build_issue_explainer_prompt, SYSTEM_ISSUE_EXPLAINER
from app.services.vector_service import search_similar
from app.services.ai_service import get_embedding, chat_complete_json
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../shared'))
from constants import CACHE_TTL_ISSUES

router = APIRouter(prefix="/api/workspace/{workspace_id}/issues", tags=["issues"])

@router.get("")
async def get_issues(workspace_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id,
                                                        Workspace.user_id == user.id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404)
    cache_key = f"issues:{workspace_id}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    # Check DB for pre-classified issues
    db_issues = await db.execute(
        select(Issue).where(Issue.workspace_id == workspace_id).limit(80)
    )
    db_rows = db_issues.scalars().all()
    if db_rows:
        issues = [
            {
                "number": i.gh_number, "title": i.title,
                "body": (i.body or "")[:500], "state": i.state,
                "labels": i.labels or [], "difficulty": i.difficulty or "intermediate",
                "estimated_hours": i.estimated_hours,
                "skills_required": i.skills_required or [],
                "learning_value": i.skills_required and "high" or "medium",
            }
            for i in db_rows
        ]
        response = {"issues": issues}
        await cache_set(cache_key, response, CACHE_TTL_ISSUES)
        return response
    # Fallback: fetch raw issues now, classify in background
    raw_issues = await get_repo_issues(user.github_token, ws.repo_owner, ws.repo_name)
    if not raw_issues or isinstance(raw_issues, dict):
        return {"issues": [], "error": "Could not fetch issues"}
    issues = [
        {
            "number": issue["number"], "title": issue["title"],
            "body": (issue.get("body") or "")[:500],
            "state": issue["state"],
            "labels": [l["name"] for l in issue.get("labels", [])],
            "html_url": issue.get("html_url"),
            "difficulty": "intermediate",
        }
        for issue in raw_issues[:80] if "pull_request" not in issue
    ]
    response = {"issues": issues, "classifying": True}
    await cache_set(cache_key, response, CACHE_TTL_ISSUES)
    return response

@router.get("/{issue_number}/explain")
async def explain_issue(workspace_id: int, issue_number: int, request: Request,
                         db: AsyncSession = Depends(get_db)):
    user: User = await get_current_user(request, db)
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id,
                                                        Workspace.user_id == user.id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404)
    cache_key = f"explain:{workspace_id}:{issue_number}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    raw_issues = await get_repo_issues(user.github_token, ws.repo_owner, ws.repo_name)
    issue = next((i for i in raw_issues if i["number"] == issue_number), None)
    if not issue:
        raise HTTPException(404, "Issue not found")
    query_text = f"{issue['title']} {(issue.get('body') or '')[:500]}"
    query_emb = await get_embedding(query_text)
    context_chunks = await search_similar(workspace_id, query_emb, limit=6)
    analysis_result = await db.execute(select(RepoAnalysis).where(RepoAnalysis.workspace_id == workspace_id))
    analysis = analysis_result.scalar_one_or_none()
    docs = analysis.docs_json if analysis else {}
    explanation = await chat_complete_json(
        [{"role": "user", "content": build_issue_explainer_prompt(issue, context_chunks, docs or {})}],
        SYSTEM_ISSUE_EXPLAINER
    )
    response = {"issue": issue, "explanation": explanation}
    await cache_set(cache_key, response, 60 * 60 * 24)
    return response
