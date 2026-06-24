"""Scan batch and result models for storing LLM responses."""
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Text, Float, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import func
from app.database import Base


class ScanBatch(Base):
    """A coherent run containing every prompt/model job for one project."""

    __tablename__ = "scan_batches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="queued", index=True)
    requested_model: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    total_jobs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_jobs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_jobs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    results = relationship("ScanResult", back_populates="batch", cascade="all, delete-orphan")


class ScanResult(Base):
    __tablename__ = "scan_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scan_batches.id"), nullable=True, index=True
    )
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    prompt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("prompts.id"), nullable=False)
    model: Mapped[str] = mapped_column(String(255), nullable=False)
    response_text: Mapped[str] = mapped_column(Text, nullable=False)
    has_url: Mapped[bool] = mapped_column(Boolean, default=False)
    has_brand: Mapped[bool] = mapped_column(Boolean, default=False)
    rank: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tokens_used: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    scanned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("ScanBatch", back_populates="results")

    __table_args__ = (
        UniqueConstraint("batch_id", "prompt_id", "model", name="uq_scan_result_batch_prompt_model"),
    )
