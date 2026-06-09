from celery import chain
from tasks.clone_task import clone_repo
from tasks.parse_task import parse_repo
from tasks.embed_task import embed_repo
from tasks.docs_task import generate_docs
from tasks.graph_task import build_graph

def run_analysis_pipeline(workspace_id: int, repo_url: str, branch: str = "main"):
    pipeline = chain(
        clone_repo.s(workspace_id, repo_url, branch),
        parse_repo.s(),
        embed_repo.s(),
        generate_docs.s(),
        build_graph.s(),
    )
    return pipeline.apply_async()
