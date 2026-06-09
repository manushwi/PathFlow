from celery_app import app
import os, sys, shutil
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../shared'))
import git
from constants import REPOS_BASE_PATH

@app.task(bind=True, name="tasks.clone")
def clone_repo(self, workspace_id: int, repo_url: str, branch: str = "main"):
    self.update_state(state="PROGRESS", meta={"status": "cloning", "progress": 10})
    repo_path = os.path.join(REPOS_BASE_PATH, str(workspace_id))
    os.makedirs(REPOS_BASE_PATH, exist_ok=True)
    if os.path.exists(repo_path):
        shutil.rmtree(repo_path)
    try:
        repo = git.Repo.clone_from(repo_url, repo_path, branch=branch, depth=1)
        sha = repo.head.commit.hexsha
    except Exception:
        try:
            repo = git.Repo.clone_from(repo_url, repo_path, depth=1)
            sha = repo.head.commit.hexsha
        except Exception as e:
            self.update_state(state="FAILURE", meta={"error": str(e)})
            raise
    _update_workspace_status(workspace_id, "analyzing", sha)
    return {"workspace_id": workspace_id, "repo_path": repo_path, "sha": sha}

def _update_workspace_status(workspace_id: int, status: str, sha: str = None):
    from sqlalchemy import create_engine, update
    from sqlalchemy.orm import sessionmaker
    from app.core.config import settings
    from app.models.workspace import Workspace, RepoAnalysis
    engine = create_engine(settings.database_url.replace("postgresql://", "postgresql+psycopg2://"))
    Session = sessionmaker(bind=engine)
    with Session() as session:
        session.execute(update(Workspace).where(Workspace.id == workspace_id).values(status=status))
        if sha:
            existing = session.query(RepoAnalysis).filter_by(workspace_id=workspace_id).first()
            if not existing:
                session.add(RepoAnalysis(workspace_id=workspace_id, repo_sha=sha))
        session.commit()
