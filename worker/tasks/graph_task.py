from celery_app import app
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))
from db_utils import get_sync_engine

@app.task(bind=True, name="tasks.graph")
def build_graph(self, prev_result: dict):
    workspace_id = prev_result["workspace_id"]
    docs = prev_result.get("docs", {})
    self.update_state(state="PROGRESS", meta={"status": "building_graph", "progress": 85})
    nodes = []
    edges = []
    node_id = 0
    def add_node(label, node_type, x, y):
        nonlocal node_id
        n = {"id": str(node_id), "type": "default",
             "data": {"label": label, "nodeType": node_type},
             "position": {"x": x, "y": y},
             "style": {"background": "#1e1e2e", "border": "1px solid #6366f1",
                        "borderRadius": "8px", "color": "#e2e8f0", "padding": "8px 12px"}}
        nodes.append(n)
        node_id += 1
        return str(node_id - 1)
    def add_edge(src, tgt, label=""):
        edges.append({"id": f"e{src}-{tgt}", "source": src, "target": tgt,
                      "label": label, "style": {"stroke": "#6366f1"},
                      "markerEnd": {"type": "ArrowClosed"}})
    arch = docs.get("architecture_type", "monolith")
    framework = docs.get("framework", "App")
    fe = add_node("Frontend", "frontend", 50, 200)
    api = add_node(f"{framework} API", "api", 300, 200)
    add_edge(fe, api, "HTTP")
    if "database_architecture" in docs and docs["database_architecture"]:
        db = add_node("Database", "database", 550, 200)
        add_edge(api, db, "SQL/ORM")
    if "auth_flow" in docs and docs["auth_flow"]:
        auth = add_node("Auth Service", "auth", 300, 50)
        add_edge(fe, auth, "OAuth")
        add_edge(auth, api)
    graph = {"nodes": nodes, "edges": edges}
    def save_graph():
        from sqlalchemy import update
        from sqlalchemy.orm import sessionmaker
        from app.models.workspace import Workspace, RepoAnalysis
        engine = get_sync_engine()
        Session = sessionmaker(bind=engine)
        with Session() as session:
            analysis = session.query(RepoAnalysis).filter_by(workspace_id=workspace_id).first()
            if analysis:
                analysis.graph_json = graph
            session.execute(update(Workspace).where(Workspace.id == workspace_id).values(status="ready"))
            session.commit()
    save_graph()
    return {"workspace_id": workspace_id, "status": "ready"}
