from fastapi import APIRouter, Depends, Response, Request, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import create_session_token
from app.core.config import settings
from app.models.user import User
from app.services.github_service import (
    exchange_code_for_token, get_github_user,
    get_user_repos, get_user_languages, estimate_skill_level
)

router = APIRouter(prefix="/api/auth", tags=["auth"])



@router.get("/github")
async def github_login():
    url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={settings.github_client_id}"
        f"&redirect_uri={settings.github_redirect_uri}"
        f"&scope=repo,user,read:org"
    )
    return RedirectResponse(url)

@router.get("/callback")
async def github_callback(code: str, db: AsyncSession = Depends(get_db)):
    token = await exchange_code_for_token(code)
    if not token:
        raise HTTPException(400, "Failed to get GitHub token")
    gh_user = await get_github_user(token)
    repos = await get_user_repos(token)
    languages = await get_user_languages(token)
    skill = estimate_skill_level(repos, languages)
    result = await db.execute(select(User).where(User.github_id == gh_user["id"]))
    user = result.scalar_one_or_none()
    if not user:
        user = User(
            github_id=gh_user["id"],
            login=gh_user["login"],
            name=gh_user.get("name"),
            avatar_url=gh_user.get("avatar_url"),
            email=gh_user.get("email"),
            github_token=token,
            skill_level=skill,
        )
        db.add(user)
    else:
        user.github_token = token
        user.avatar_url = gh_user.get("avatar_url")
    await db.commit()
    await db.refresh(user)
    session_token = create_session_token(user.id)
    response = RedirectResponse(f"{settings.frontend_url}/dashboard")
    response.set_cookie("session", session_token, httponly=True, samesite="lax",
                        max_age=86400 * 30, secure=settings.environment == "production")
    return response

@router.get("/me")
async def get_me(request: Request, db: AsyncSession = Depends(get_db)):
    from app.core.deps import get_current_user
    user = await get_current_user(request, db)
    return {
        "id": user.id, "login": user.login, "name": user.name,
        "avatar_url": user.avatar_url, "email": user.email,
        "skill_level": user.skill_level, "skill_confirmed": user.skill_confirmed,
    }

@router.post("/signout")
async def signout(response: Response):
    response.delete_cookie("session")
    return {"ok": True}

@router.patch("/skill")
async def update_skill(request: Request, db: AsyncSession = Depends(get_db)):
    from app.core.deps import get_current_user
    user = await get_current_user(request, db)
    body = await request.json()
    user.skill_level = body["skill_level"]
    user.skill_confirmed = True
    await db.commit()
    return {"ok": True}
