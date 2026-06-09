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
from shared.prompts import build_chat_prompt, SYSTEM_AI_SOLVER
import json

router = APIRouter(prefix="/api/ai", tags=["ai"])

@router.post("/chat")
async def stream_chat(request: Request, db: AsyncSession = Depends(get_db)):
    check_rate_limit(get_client_key(request), max_requests=30, window_seconds=60)
    user: User = await get_current_user(request, db)
    body = await request.json()
    workspace_id = body["workspace_id"]
    message = body["message"]
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
async def solve_issue(request: Request, db: AsyncSession = Depends(get_db)):
    check_rate_limit(get_client_key(request), max_requests=10, window_seconds=60)
    user: User = await get_current_user(request, db)
    body = await request.json()
    workspace_id = body["workspace_id"]
    issue_number = body["issue_number"]
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
