from celery_app import app
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../shared'))
from constants import REPOS_BASE_PATH

SKIP_DIRS = {'.git', 'node_modules', '__pycache__', '.next', 'dist', 'build', '.venv', 'venv'}
CODE_EXTENSIONS = {'.py', '.js', '.ts', '.tsx', '.jsx', '.go', '.rs', '.java', '.rb', '.php',
                   '.cpp', '.c', '.h', '.css', '.html', '.md', '.json', '.yaml', '.yml', '.toml'}
STACK_INDICATORS = {
    "package.json": "Node.js", "requirements.txt": "Python", "go.mod": "Go",
    "Cargo.toml": "Rust", "pom.xml": "Java", "Gemfile": "Ruby",
    "next.config": "Next.js", "vite.config": "Vite", "django": "Django",
    "fastapi": "FastAPI", "flask": "Flask", "express": "Express.js",
}

@app.task(bind=True, name="tasks.parse")
def parse_repo(self, prev_result: dict):
    workspace_id = prev_result["workspace_id"]
    repo_path = prev_result["repo_path"]
    self.update_state(state="PROGRESS", meta={"status": "parsing", "progress": 25})
    file_tree = {}
    all_files = []
    tech_stack = {}
    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        rel_root = os.path.relpath(root, repo_path)
        for fname in files:
            fpath = os.path.join(root, fname)
            rel_path = os.path.join(rel_root, fname).replace("\\", "/").lstrip("./")
            ext = os.path.splitext(fname)[1]
            if ext in CODE_EXTENSIONS:
                size = os.path.getsize(fpath)
                all_files.append({"path": rel_path, "ext": ext, "size": size})
                for indicator, stack_name in STACK_INDICATORS.items():
                    if indicator in rel_path.lower():
                        tech_stack[stack_name] = True
    tree = {}
    for f in all_files:
        parts = f["path"].split("/")
        node = tree
        for part in parts[:-1]:
            node = node.setdefault(part, {})
        node[parts[-1]] = {"type": "file", "size": f["size"], "ext": f["ext"]}
    _save_parse_results(workspace_id, tree, tech_stack)
    return {"workspace_id": workspace_id, "repo_path": repo_path,
            "all_files": all_files, "tech_stack": list(tech_stack.keys())}

def _save_parse_results(workspace_id, tree, tech_stack):
    from sqlalchemy import create_engine, update
    from sqlalchemy.orm import sessionmaker
    from app.core.config import settings
    from app.models.workspace import Workspace, RepoAnalysis
    engine = create_engine(settings.database_url.replace("postgresql://", "postgresql+psycopg2://"))
    Session = sessionmaker(bind=engine)
    with Session() as session:
        analysis = session.query(RepoAnalysis).filter_by(workspace_id=workspace_id).first()
        if analysis:
            analysis.file_tree = tree
            analysis.tech_stack = {"detected": list(tech_stack.keys())}
        session.execute(update(Workspace).where(Workspace.id == workspace_id).values(status="embedding"))
        session.commit()
