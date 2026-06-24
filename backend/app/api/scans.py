"""Scan results API endpoints for GEOTrack AI."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.dependencies import get_current_organization
from app.models.project import Project
from app.models.scan_result import ScanResult
from app.services.scan_queue import enqueue_scan
from app.services.scanner import calculate_sov

router = APIRouter(prefix="/projects", tags=["scans"])


# ---------------------------------------------------------------------------
# Pydantic response schemas
# ---------------------------------------------------------------------------

class ScanResultResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    prompt_id: uuid.UUID
    model: str
    has_url: bool
    has_brand: bool
    rank: Optional[int] = None
    latency_ms: Optional[int] = None
    tokens_used: Optional[int] = None
    cost: Optional[float] = None
    scanned_at: datetime

    class Config:
        from_attributes = True


class SOVStats(BaseModel):
    total_scans: int
    url_found: int
    brand_found: int
    sov_url: float
    sov_brand: float
    average_rank: Optional[float] = None


class LatestScanResponse(BaseModel):
    scanned_at: datetime
    results: list[ScanResultResponse]
    sov: SOVStats


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/{project_id}/scan", status_code=status.HTTP_202_ACCEPTED)
async def trigger_scan(
    project_id: str,
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger a scan for all prompts in a project.

    Returns immediately with HTTP 202; actual scanning happens
    asynchronously via the ARQ queue.
    """
    # Verify the project exists and belongs to this org
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.organization_id == org_id,
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    summary = await enqueue_scan(project_id)
    return {
        "status": "accepted",
        "message": f"Scan enqueued ({summary['enqueued']} jobs)",
        "project_id": project_id,
        "enqueued": summary["enqueued"],
    }


@router.get("/{project_id}/results", response_model=list[ScanResultResponse])
async def list_results(
    project_id: str,
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Return historical scan results for a project, most recent first."""
    # Verify project belongs to org
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.organization_id == org_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    results = await db.execute(
        select(ScanResult)
        .where(ScanResult.project_id == project_id)
        .order_by(desc(ScanResult.scanned_at))
        .offset(offset)
        .limit(limit)
    )
    return results.scalars().all()


@router.get("/{project_id}/results/latest", response_model=LatestScanResponse)
async def get_latest_results(
    project_id: str,
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    """Return the most recent scan batch with SOV statistics."""
    # Verify project belongs to org
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.organization_id == org_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    # Get the latest scanned_at timestamp
    latest_time_result = await db.execute(
        select(func.max(ScanResult.scanned_at))
        .where(ScanResult.project_id == project_id)
    )
    latest_at = latest_time_result.scalar()
    if not latest_at:
        raise HTTPException(
            status_code=404,
            detail="No scan results found for this project",
        )

    # Get all results from that scan batch
    results_result = await db.execute(
        select(ScanResult)
        .where(
            ScanResult.project_id == project_id,
            ScanResult.scanned_at == latest_at,
        )
        .order_by(ScanResult.model, ScanResult.prompt_id)
    )
    results = results_result.scalars().all()

    # Compute SOV
    total = len(results)
    url_ok = sum(1 for r in results if r.has_url)
    brand_ok = sum(1 for r in results if r.has_brand)
    ranks = [r.rank for r in results if r.rank is not None]

    sov = SOVStats(
        total_scans=total,
        url_found=url_ok,
        brand_found=brand_ok,
        sov_url=calculate_sov(url_ok, total),
        sov_brand=calculate_sov(brand_ok, total),
        average_rank=round(sum(ranks) / len(ranks), 1) if ranks else None,
    )

    return LatestScanResponse(
        scanned_at=latest_at,
        results=results,
        sov=sov,
    )
