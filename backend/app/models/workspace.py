from sqlalchemy import String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone
from app.core.database import Base

class Workspace(Base):
    __tablename__ = "workspaces"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    repo_url: Mapped[str] = mapped_column(String(500))
    repo_owner: Mapped[str] = mapped_column(String(200))
    repo_name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(50), default="pending")
    branch: Mapped[str] = mapped_column(String(200), default="main")
    active_issue_number: Mapped[int | None]
    last_active: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    user: Mapped["User"] = relationship(back_populates="workspaces")
    analysis: Mapped["RepoAnalysis | None"] = relationship(back_populates="workspace", uselist=False)
    files: Mapped[list["WorkspaceFile"]] = relationship(back_populates="workspace")
    messages: Mapped[list["ChatMessage"]] = relationship(back_populates="workspace")
    issues: Mapped[list["Issue"]] = relationship(back_populates="workspace")

class RepoAnalysis(Base):
    __tablename__ = "repo_analyses"
    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), unique=True)
    tech_stack: Mapped[dict | None] = mapped_column(JSON)
    docs_json: Mapped[dict | None] = mapped_column(JSON)
    graph_json: Mapped[dict | None] = mapped_column(JSON)
    file_tree: Mapped[dict | None] = mapped_column(JSON)
    repo_sha: Mapped[str | None] = mapped_column(String(100))
    embedded_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    workspace: Mapped["Workspace"] = relationship(back_populates="analysis")

class WorkspaceFile(Base):
    __tablename__ = "workspace_files"
    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"))
    file_path: Mapped[str] = mapped_column(String(1000))
    cursor_line: Mapped[int] = mapped_column(default=0)
    cursor_col: Mapped[int] = mapped_column(default=0)
    is_open: Mapped[bool] = mapped_column(default=True)
    workspace: Mapped["Workspace"] = relationship(back_populates="files")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"))
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    workspace: Mapped["Workspace"] = relationship(back_populates="messages")
