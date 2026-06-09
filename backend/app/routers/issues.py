from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.workspace import Workspace, RepoAnalysis
from app.models.issue import Issue
from app.models.user import User
from app.services.github_service import get_repo_issues
from app.services.ai_service import chat_complete_json
from app.services.cache_service import cache_get, cache_set
from shared.prompts import SYSTEM_ISSUE_CLASSIFIER, build_issue_classifier_prompt, build_issue_explainer_prompt, SYSTEM_ISSUE_EXPLAINER
from app.services.vector_service import search_similar
from app.services.ai_service import get_embedding
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
    raw_issues = await get_repo_issues(user.github_token, ws.repo_owner, ws.repo_name)
    if not raw_issues or isinstance(raw_issues, dict):
        return {"issues": [], "error": "Could not fetch issues"}
    analysis_result = await db.execute(select(RepoAnalysis).where(RepoAnalysis.workspace_id == workspace_id))
    analysis = analysis_result.scalar_one_or_none()
    docs = analysis.docs_json if analysis else {}
    try:
        classifications = await chat_complete_json(
            [{"role": "user", "content": build_issue_classifier_prompt(raw_issues, docs or {})}],
            SYSTEM_ISSUE_CLASSIFIER
        )
        class_map = {c["number"]: c for c in classifications}
    except Exception:
        class_map = {}
    issues = []
    for issue in raw_issues[:80]:
        if "pull_request" in issue:
            continue
        num = issue["number"]
        cl = class_map.get(num, {})
        difficulty = cl.get("difficulty", "intermediate")
        estimated_hours = cl.get("estimated_hours")
        skills_required = cl.get("skills_required", [])
        issues.append({
            "number": num, "title": issue["title"],
            "body": (issue.get("body") or "")[:500],
            "state": issue["state"],
            "labels": [l["name"] for l in issue.get("labels", [])],
            "html_url": issue.get("html_url"),
            "difficulty": difficulty,
            "estimated_hours": estimated_hours,
            "skills_required": skills_required,
            "learning_value": cl.get("learning_value", "medium"),
        })
        # Persist to DB
        existing_issue = await db.execute(
            select(Issue).where(Issue.workspace_id == workspace_id, Issue.gh_number == num)
        )
        if not existing_issue.scalar_one_or_none():
            db.add(Issue(
                workspace_id=workspace_id,
                gh_number=num,
                title=issue["title"],
                body=(issue.get("body") or "")[:5000],
                state=issue["state"],
                labels=[l["name"] for l in issue.get("labels", [])],
                difficulty=difficulty,
                estimated_hours=estimated_hours,
                skills_required=skills_required,
            ))
    await db.commit()
    response = {"issues": issues}
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
