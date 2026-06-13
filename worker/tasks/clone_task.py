from celery_app import app
import os, sys, shutil
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../shared'))
import git
from constants import REPOS_BASE_PATH
from db_utils import get_sync_engine

@app.task(bind=True, name="tasks.clone")
def clone_repo(self, workspace_id: int, repo_url: str, branch: str = "main"):
    try:
        self.update_state(state="PROGRESS", meta={"status": "cloning", "progress": 10})
        repo_path = os.path.join(REPOS_BASE_PATH, str(workspace_id))
        os.makedirs(REPOS_BASE_PATH, exist_ok=True)
        if os.path.exists(repo_path):
            shutil.rmtree(repo_path)
        try:
            repo = git.Repo.clone_from(repo_url, repo_path, branch=branch,
                                       depth=1, single_branch=True)
            sha = repo.head.commit.hexsha
            active_branch = branch
        except Exception:
            if os.path.exists(repo_path):
                shutil.rmtree(repo_path)
            try:
                repo = git.Repo.clone_from(repo_url, repo_path, branch=branch)
                sha = repo.head.commit.hexsha
                active_branch = branch
            except Exception:
                if os.path.exists(repo_path):
                    shutil.rmtree(repo_path)
                try:
                    repo = git.Repo.clone_from(repo_url, repo_path)
                    sha = repo.head.commit.hexsha
                    active_branch = repo.active_branch.name
                except Exception as e:
                    self.update_state(state="FAILURE", meta={"error": str(e)})
                    raise
        _update_workspace_status(workspace_id, "analyzing", sha, active_branch)
        return {"workspace_id": workspace_id, "repo_path": repo_path, "sha": sha}
    except Exception:
        from sqlalchemy import update
        from app.models.workspace import Workspace
        engine = get_sync_engine()
        with engine.connect() as conn:
            conn.execute(update(Workspace).where(Workspace.id == workspace_id).values(status="error"))
            conn.commit()
        raise

def _update_workspace_status(workspace_id: int, status: str, sha: str = None, branch: str = None):
    from sqlalchemy import update
    from sqlalchemy.orm import sessionmaker
    from app.models.workspace import Workspace, RepoAnalysis
    engine = get_sync_engine()
    Session = sessionmaker(bind=engine)
    with Session() as session:
        update_values = {"status": status}
        if branch:
            update_values["branch"] = branch
        session.execute(update(Workspace).where(Workspace.id == workspace_id).values(**update_values))
        if sha:
            existing = session.query(RepoAnalysis).filter_by(workspace_id=workspace_id).first()
            if not existing:
                session.add(RepoAnalysis(workspace_id=workspace_id, repo_sha=sha))
        session.commit()
