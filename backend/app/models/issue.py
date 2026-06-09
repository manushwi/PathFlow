from sqlalchemy import String, ForeignKey, Text, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class Issue(Base):
    __tablename__ = "issues"
    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"))
    gh_number: Mapped[int]
    title: Mapped[str] = mapped_column(String(500))
    body: Mapped[str | None] = mapped_column(Text)
    state: Mapped[str] = mapped_column(String(20))
    labels: Mapped[list | None] = mapped_column(JSON)
    difficulty: Mapped[str | None] = mapped_column(String(20))
    estimated_hours: Mapped[float | None]
    skills_required: Mapped[list | None] = mapped_column(JSON)
    ai_explanation: Mapped[dict | None] = mapped_column(JSON)
    workspace: Mapped["Workspace"] = relationship(back_populates="issues")
