from celery_app import app
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))
from db_utils import get_sync_engine

@app.task(bind=True, name="tasks.graph")
def build_graph(self, prev_result: dict):
    try:
        workspace_id = prev_result["workspace_id"]
        files = prev_result.get("all_files", prev_result.get("files", []))
        tech_stack = prev_result.get("tech_stack", {})
        docs = prev_result.get("docs", {})
        self.update_state(state="PROGRESS", meta={"status": "building_graph", "progress": 85})

        nodes = []
        edges = []

        dirs = {}
        for f in files:
            path = f["path"] if isinstance(f, dict) else f
            parts = path.split("/")
            top_dir = parts[0] if len(parts) > 1 else "root"
            if top_dir not in dirs:
                dirs[top_dir] = []
            dirs[top_dir].append(path)

        x_pos = 50
        node_id_map = {}
        for i, (dir_name, dir_files) in enumerate(sorted(dirs.items())):
            nid = str(i)
            label = dir_name.replace("_", " ").title()
            node_id_map[dir_name] = nid
            style = {
                "background": "#1e1e2e",
                "border": "1px solid #6366f1",
                "borderRadius": "8px",
                "color": "#e2e8f0",
                "padding": "8px 12px",
            }
            if dir_name == "root":
                style["border"] = "1px solid #10b981"
            nodes.append({
                "id": nid,
                "type": "default",
                "data": {"label": label, "nodeType": "module", "files": len(dir_files)},
                "position": {"x": x_pos, "y": 200},
                "style": style,
            })
            x_pos += 250

        dir_names = sorted(dirs.keys())
        for i in range(len(dir_names) - 1):
            edges.append({
                "id": f"e{i}-{i+1}",
                "source": str(i),
                "target": str(i + 1),
                "label": "depends",
                "style": {"stroke": "#6366f1"},
                "markerEnd": {"type": "ArrowClosed"},
            })

        if tech_stack:
            techs = list(tech_stack) if isinstance(tech_stack, list) else list(tech_stack.keys())
            if techs:
                tech_id = str(len(dir_names))
                nodes.append({
                    "id": tech_id,
                    "type": "default",
                    "data": {"label": "Tech Stack", "tech": techs[:5]},
                    "position": {"x": x_pos + 100, "y": 50},
                    "style": {"background": "#1e1e2e", "border": "1px solid #f59e0b",
                              "borderRadius": "8px", "color": "#e2e8f0", "padding": "8px 12px"},
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

        return {"workspace_id": workspace_id, "status": "ready"}
    except Exception:
        from sqlalchemy import update
        from app.models.workspace import Workspace
        engine = get_sync_engine()
        with engine.connect() as conn:
            conn.execute(update(Workspace).where(Workspace.id == prev_result["workspace_id"]).values(status="error"))
            conn.commit()
        raise
