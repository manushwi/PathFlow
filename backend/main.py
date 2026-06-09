import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers import auth, workspace, issues, files, ai, git

app = FastAPI(title="PatchFlow API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in [auth.router, workspace.router, issues.router, files.router, ai.router, git.router]:
    app.include_router(router)

@app.get("/health")
async def health():
    return {"status": "ok"}
