import asyncio
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import _get_engine
from app.models.workspace import Workspace
from sqlalchemy import select

async def main():
    _, AsyncSessionLocal = _get_engine()
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Workspace))
        workspaces = result.scalars().all()
        print("Workspaces found:", len(workspaces))
        for ws in workspaces:
            print(f"ID: {ws.id}, Repo: {ws.repo_owner}/{ws.repo_name}, Status: {ws.status}, Branch: {ws.branch}")

if __name__ == "__main__":
    asyncio.run(main())
