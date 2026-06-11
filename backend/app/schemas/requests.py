from pydantic import BaseModel, Field
from typing import Optional

class CreateWorkspaceRequest(BaseModel):
    repo_url: str = Field(..., min_length=1, description="GitHub repository URL")

class ChatRequest(BaseModel):
    workspace_id: int
    message: str = Field(..., min_length=1, max_length=4000)

class SolveIssueRequest(BaseModel):
    workspace_id: int
    issue_number: int

class SaveFileRequest(BaseModel):
    path: str
    content: str

class SaveOpenFilesRequest(BaseModel):
    files: list[dict]

class CommitRequest(BaseModel):
    workspace_id: int
    message: str = Field(..., min_length=1, max_length=2000)

class CreateBranchRequest(BaseModel):
    workspace_id: int
    name: str = Field(..., min_length=1, max_length=200)

class GeneratePRRequest(BaseModel):
    workspace_id: int
    issue_number: int = 0
    diff: str = ""

class CreatePRRequest(BaseModel):
    workspace_id: int
    title: str = Field(..., min_length=1, max_length=500)
    body: str = ""

class TerminalExecRequest(BaseModel):
    workspace_id: int
    command: str = Field(..., min_length=1, max_length=1000)

class UpdateSkillRequest(BaseModel):
    skill_level: str = Field(..., pattern=r"^(beginner|intermediate|advanced)$")
