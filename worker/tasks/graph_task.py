from celery_app import app
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))
from db_utils import get_sync_engine

@app.task(bind=True, name="tasks.graph")
def build_graph(self, results):
    # Chord passes a list of results (embed_result, docs_result); chain passes a single dict
    if isinstance(results, list):
        prev_result = {}
        for r in results:
            if isinstance(r, dict):
                prev_result.update(r)
    else:
        prev_result = results
    try:
        workspace_id = prev_result["workspace_id"]
        files = prev_result.get("all_files", prev_result.get("files", []))
        tech_stack = prev_result.get("tech_stack", {})
        docs = prev_result.get("docs", {})
        self.update_state(state="PROGRESS", meta={"status": "building_graph", "progress": 85})

        nodes = []
        edges = []
        modules = docs.get("modules", [])

        if modules:
            for i, mod in enumerate(modules):
                file_count = len(mod.get("key_files", []))
                nodes.append({
                    "id": mod["name"],
                    "type": "module",
                    "data": {
                        "label": mod["name"],
                        "purpose": mod.get("purpose", ""),
                        "path": mod.get("path", ""),
                        "files": file_count,
                        "key_files": mod.get("key_files", []),
                    },
                    "position": {"x": (i % 4) * 280, "y": (i // 4) * 180},
                })
            for mod in modules:
                for dep in mod.get("depends_on", []):
                    edges.append({
                        "id": f"{mod['name']}-{dep}",
                        "source": mod["name"],
                        "target": dep,
                        "type": "smoothstep",
                        "animated": True,
                    })
        else:
            dirs = {}
            for f in files:
                path = f["path"] if isinstance(f, dict) else f
                parts = path.split("/")
                top_dir = parts[0] if len(parts) > 1 else "root"
                if top_dir not in dirs:
                    dirs[top_dir] = []
                dirs[top_dir].append(path)

            for i, (dir_name, dir_files) in enumerate(sorted(dirs.items())):
                label = dir_name.replace("_", " ").title()
                nodes.append({
                    "id": str(i),
                    "type": "module",
                    "data": {
                        "label": label,
                        "purpose": "",
                        "path": dir_name,
                        "files": len(dir_files),
                        "key_files": [],
                    },
                    "position": {"x": (i % 4) * 280, "y": (i // 4) * 180},
                })

            dir_names = sorted(dirs.keys())
            for i in range(len(dir_names) - 1):
                edges.append({
                    "id": f"e{i}-{i+1}",
                    "source": str(i),
                    "target": str(i + 1),
                    "type": "smoothstep",
                    "animated": True,
                })

        if tech_stack:
            techs = tech_stack if isinstance(tech_stack, list) else tech_stack.get("detected", [])
            if techs:
                tech_id = "tech-stack"
                nodes.append({
                    "id": tech_id,
                    "type": "module",
                    "data": {
                        "label": "Tech Stack",
                        "purpose": f"Uses: {', '.join(techs[:5])}",
                        "path": "",
                        "files": 0,
                        "key_files": [],
                        "is_tech_node": True,
                    },
                    "position": {"x": 50, "y": (max(len(modules) if modules else len(dirs), 1) + 1) * 180},
                })

        graph_data = {"nodes": nodes, "edges": edges}

        from sqlalchemy import update
        from sqlalchemy.orm import sessionmaker
        from app.models.workspace import Workspace, RepoAnalysis
        engine = get_sync_engine()
        Session = sessionmaker(bind=engine)
        with Session() as session:
            analysis = session.query(RepoAnalysis).filter_by(workspace_id=workspace_id).first()
            if analysis:
                analysis.graph_json = graph_data
            session.execute(update(Workspace).where(Workspace.id == workspace_id).values(status="ready"))
            session.commit()

        import tasks.issues_task
        from tasks.issues_task import classify_issues
        classify_issues.delay(workspace_id)

        return {"workspace_id": workspace_id, "status": "ready"}
    except Exception:
        from sqlalchemy import update
        from app.models.workspace import Workspace
        engine = get_sync_engine()
        with engine.connect() as conn:
            conn.execute(update(Workspace).where(Workspace.id == prev_result["workspace_id"]).values(status="error"))
            conn.commit()
        raise
