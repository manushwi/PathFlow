SYSTEM_REPO_DOCS = """You are an expert software architect. Analyze the given repository structure and generate comprehensive documentation. Be precise and factual. Output JSON only."""

SYSTEM_ISSUE_CLASSIFIER = """You are an expert open source contributor. Classify GitHub issues by difficulty based on their content, labels, and the repository's tech stack. Output JSON only."""

SYSTEM_ISSUE_EXPLAINER = """You are a helpful mentor for open source contributors. Explain GitHub issues clearly, identify root causes, suggest fixes, and list learning resources. Output JSON only."""

SYSTEM_AI_SOLVER = """You are an expert software engineer. Analyze the issue and relevant code context, then generate a precise implementation plan with targeted search/replace edits. Only change the specific lines needed — preserve all comments, docstrings, README content, and unrelated code. Return JSON only."""

SYSTEM_PR_UPDATER = """You are an expert software engineer. A pull request you authored has received review feedback from a human reviewer. Your task is to address ALL the feedback by making targeted changes to the code.

Rules:
1. Read each review comment carefully and understand what change is being requested
2. Make ONLY the changes requested — do not add unrelated features or refactoring
3. Preserve all existing comments, docstrings, README content, and unrelated code
4. If a review comment asks a question or gives a suggestion (not a change request), you can skip it
5. If multiple comments ask for the same change, make it once
6. Return the complete updated file content for every file that needs changes

Return JSON:
{
  "plan": ["step 1", "step 2"],
  "files_to_change": [
    {
      "path": "relative/path.py",
      "description": "what to change and which review comment(s) this addresses",
      "edits": [
        {
          "search": "exact existing lines of code to find (must be unique in the file)",
          "replace": "new code to substitute in place of search"
        }
      ]
    }
  ],
  "explanation": "summary of what feedback was addressed (2-3 sentences)",
  "commit_message": "descriptive conventional commit message explaining what was updated based on review feedback"
}"""

SYSTEM_CHAT_ASSISTANT = """You are PathFlow AI — an expert coding assistant embedded in a developer IDE. You have context from the repository's codebase via RAG retrieval. Be concise, helpful, and accurate. When showing code, use markdown code blocks."""

def build_repo_docs_prompt(file_tree: str, sample_files: str, stack_hints: str) -> str:
    return f"""Analyze this repository and generate documentation for both beginners and experienced developers.

Tech stack hints: {stack_hints}
File tree:
{file_tree}
Key file samples:
{sample_files}

Return JSON with this exact structure:
{{
  "overview": "2-3 sentence plain-English summary of what this project does",
  "beginner_explanation": "explain like to someone new to this stack - what is this, why does it exist, how does it work at a high level (4-6 sentences)",
  "professional_summary": "concise technical summary: architecture pattern, key design decisions, notable tradeoffs (3-5 sentences)",
  "framework": "main framework",
  "languages": ["..."],
  "architecture_type": "monolith|microservices|serverless|library",
  "modules": [
    {{
      "name": "auth",
      "path": "src/auth",
      "purpose": "what this module does",
      "key_files": [
        {{"path": "src/auth/login.ts", "role": "handles login endpoint and session creation"}}
      ],
      "depends_on": ["db", "config"]
    }}
  ],
  "workflows": [
    {{
      "name": "User login flow",
      "description": "step by step what happens",
      "steps": [
        {{"step": "User submits credentials", "file": "src/auth/login.ts"}},
        {{"step": "Password verified against DB", "file": "src/db/users.ts"}},
        {{"step": "Session token issued", "file": "src/auth/session.ts"}}
      ]
    }}
  ],
  "key_concepts": ["concept1", "concept2"],
  "auth_flow": "description or null",
  "api_architecture": "description or null",
  "database_architecture": "description or null",
  "deployment": "description or null"
}}

Identify 4-8 real modules based on the file tree (not generic top-level folders unless they're meaningful), and 2-4 important workflows (e.g. auth, data fetching, main user action) tracing through actual files you can see in the tree/samples."""

def build_issue_classifier_prompt(issues: list, repo_docs: dict) -> str:
    import json
    return f"""Classify these GitHub issues by difficulty.

Repository context: {repo_docs.get('overview', '')}
Tech stack: {repo_docs.get('framework', '')} | {', '.join(repo_docs.get('languages', []))}

Issues to classify:
{json.dumps([{'number': i['number'], 'title': i['title'], 'body': (i.get('body') or '')[:300], 'labels': i.get('labels', [])} for i in issues[:50]], indent=2)}

Return JSON array:
[{{"number": 123, "difficulty": "beginner|intermediate|advanced", "estimated_hours": 2.5, "skills_required": ["Python", "FastAPI"], "learning_value": "high|medium|low"}}]"""

def build_issue_explainer_prompt(issue: dict, context_chunks: list, repo_docs: dict) -> str:
    import json
    context = "\n".join([f"File: {c['file_path']}\n{c['content'][:500]}" for c in context_chunks[:5]])
    return f"""Explain this GitHub issue for a developer who wants to fix it.

Issue #{issue['number']}: {issue['title']}
Body: {issue.get('body', 'No description')[:1000]}

Relevant codebase context:
{context}

Repository overview: {repo_docs.get('overview', '')}

Return JSON:
{{
  "summary": "plain English explanation",
  "why_it_happens": "root cause explanation",
  "files_likely_involved": ["path/to/file.py"],
  "suggested_fix": "step by step suggestion",
  "learning_resources": ["concept or link"],
  "risk_level": "low|medium|high"
}}"""

def build_chat_prompt(question: str, context_chunks: list, chat_history: list, workspace_info: dict) -> list:
    context = "\n\n".join([f"// {c['file_path']}\n{c['content'][:600]}" for c in context_chunks])
    system_context = f"""Repository: {workspace_info.get('repo_name', 'unknown')}
Tech stack: {workspace_info.get('framework', '')}

Relevant code context:
{context}"""
    messages = [{"role": "system", "content": f"{SYSTEM_CHAT_ASSISTANT}\n\n{system_context}"}]
    messages.extend(chat_history[-10:])
    messages.append({"role": "user", "content": question})
    return messages
