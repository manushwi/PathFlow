from celery_app import app
import asyncio, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../shared'))
from db_utils import get_sync_engine

@app.task(bind=True, name="tasks.issues")
def classify_issues(self, workspace_id):
    import logging
    logger = logging.getLogger(__name__)
    try:
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy import select
        from app.models.workspace import Workspace, RepoAnalysis
        from app.models.issue import Issue
        from app.services.github_service import get_repo_issues
        from app.services.ai_service import chat_complete_json
        from app.services.cache_service import sync_cache_set
        from prompts import SYSTEM_ISSUE_CLASSIFIER, build_issue_classifier_prompt
        from constants import CACHE_TTL_ISSUES

        self.update_state(state="PROGRESS", meta={"status": "classifying_issues", "progress": 95})

        engine = get_sync_engine()
        Session = sessionmaker(bind=engine)
        with Session() as session:
            ws = session.execute(
                select(Workspace).where(Workspace.id == workspace_id)
            ).scalar_one_or_none()
            if not ws:
                logger.error(f"Workspace {workspace_id} not found")
                return
            owner = ws.repo_owner
            repo = ws.repo_name
            token = ws.user.github_token if ws.user else None

            analysis = session.execute(
                select(RepoAnalysis).where(RepoAnalysis.workspace_id == workspace_id)
            ).scalar_one_or_none()
            docs = analysis.docs_json if analysis else {}

        if not token:
            logger.error(f"No GitHub token for workspace {workspace_id}")
            return

        async def do_classify():
            raw_issues = await get_repo_issues(token, owner, repo)
            if not raw_issues or isinstance(raw_issues, dict):
                return None, {}
            try:
                classifications = await chat_complete_json(
                    [{"role": "user", "content": build_issue_classifier_prompt(raw_issues, docs or {})}],
                    SYSTEM_ISSUE_CLASSIFIER
                )
                class_map = {c["number"]: c for c in classifications}
            except Exception as e:
                logger.warning(f"Issue classification failed: {e}")
                class_map = {}
            return raw_issues, class_map

        raw_issues, class_map = asyncio.run(do_classify())
        if not raw_issues:
            return

        with Session() as session:
            for issue in raw_issues[:80]:
                if "pull_request" in issue:
                    continue
                num = issue["number"]
                cl = class_map.get(num, {})
                existing = session.execute(
                    select(Issue).where(Issue.workspace_id == workspace_id, Issue.gh_number == num)
                ).scalar_one_or_none()
                if not existing:
                    session.add(Issue(
                        workspace_id=workspace_id,
                        gh_number=num,
                        title=issue["title"],
                        body=(issue.get("body") or "")[:5000],
                        state=issue["state"],
                        labels=[l["name"] for l in issue.get("labels", [])],
                        difficulty=cl.get("difficulty", "intermediate"),
                        estimated_hours=cl.get("estimated_hours"),
                        skills_required=cl.get("skills_required", []),
                    ))
            session.commit()

        issues_response = {"issues": [
            {
                "number": issue["number"],
                "title": issue["title"],
                "body": (issue.get("body") or "")[:500],
                "state": issue["state"],
                "labels": [l["name"] for l in issue.get("labels", [])],
                "html_url": issue.get("html_url"),
                "difficulty": class_map.get(issue["number"], {}).get("difficulty", "intermediate"),
                "estimated_hours": class_map.get(issue["number"], {}).get("estimated_hours"),
                "skills_required": class_map.get(issue["number"], {}).get("skills_required", []),
                "learning_value": class_map.get(issue["number"], {}).get("learning_value", "medium"),
            }
            for issue in raw_issues[:80] if "pull_request" not in issue
        ]}
        sync_cache_set(f"issues:{workspace_id}", issues_response, CACHE_TTL_ISSUES)
        logger.info(f"Classified {len(issues_response['issues'])} issues for workspace {workspace_id}")
    except Exception as e:
        logger.error(f"Issue classification failed for workspace {workspace_id}: {e}")
