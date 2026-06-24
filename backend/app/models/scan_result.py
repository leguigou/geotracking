"""Scan result model for storing LLM responses."""
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import func
from app.database import Base


class ScanResult(Base):
    __tablename__ = "scan_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    prompt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("prompts.id"), nullable=False)
    model: Mapped[str] = mapped_column(String(50), nullable=False)
    response_text: Mapped[str] = mapped_column(Text, nullable=False)
    has_url: Mapped[bool] = mapped_column(Boolean, default=False)
    has_brand: Mapped[bool] = mapped_column(Boolean, default=False)
    rank: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tokens_used: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    has_changes: Mapped[bool] = mapped_column(Boolean, default=False)
    scanned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    prompt = relationship("Prompt", lazy="joined")
