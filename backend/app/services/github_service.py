import httpx
from app.core.config import settings

GITHUB_API = "https://api.github.com"

async def exchange_code_for_token(code: str) -> str:
    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": settings.github_redirect_uri,
            },
            headers={"Accept": "application/json"},
        )
        data = r.json()
        return data.get("access_token")

async def get_github_user(token: str) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{GITHUB_API}/user",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
        )
        return r.json()

async def get_user_repos(token: str) -> list:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{GITHUB_API}/user/repos?per_page=100&sort=updated",
            headers={"Authorization": f"Bearer {token}"},
        )
        return r.json()

async def get_user_languages(token: str) -> dict[str, int]:
    repos = await get_user_repos(token)
    lang_counts: dict[str, int] = {}
    async with httpx.AsyncClient() as client:
        for repo in repos[:20]:
            if repo.get("language"):
                lang_counts[repo["language"]] = lang_counts.get(repo["language"], 0) + 1
    return lang_counts

def estimate_skill_level(repos: list, languages: dict) -> str:
    total_repos = len(repos)
    stars = sum(r.get("stargazers_count", 0) for r in repos)
    if total_repos > 50 or stars > 100:
        return "advanced"
    elif total_repos > 15 or stars > 10:
        return "intermediate"
    return "beginner"

async def get_repo_issues(token: str, owner: str, repo: str, state: str = "open") -> list:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/issues?state={state}&per_page=100",
            headers={"Authorization": f"Bearer {token}"},
        )
        return r.json()

async def create_pull_request(token: str, owner: str, repo: str, title: str,
                               body: str, head: str, base: str) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{GITHUB_API}/repos/{owner}/{repo}/pulls",
            json={"title": title, "body": body, "head": head, "base": base},
            headers={"Authorization": f"Bearer {token}"},
        )
        return r.json()
