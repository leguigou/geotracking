"""Scan results API endpoints for GEOTrack AI."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.dependencies import get_current_user, get_current_organization
from app.models.project import Project
from app.models.scan_result import ScanResult
from app.models.user import User
from app.services.scan_queue import enqueue_scan
from app.services.scanner import calculate_sov
from app.services.audit import log_action

router = APIRouter(prefix="/projects", tags=["scans"])


def _resolve_uuid(project_id: str) -> uuid.UUID:
    """Parse project_id as UUID; raise 422 on failure."""
    try:
        return uuid.UUID(project_id)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid project ID: '{project_id}'")


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
    response_text: str | None = None

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
    current_user: User = Depends(get_current_user),
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
    model: str | None = None,
):
    """Manually trigger a scan for all prompts in a project.

    If *model* is provided, only scan with that specific model.
    """
    uid = _resolve_uuid(project_id)
    # Verify the project exists and belongs to this org
    result = await db.execute(
        select(Project).where(
            Project.id == uid,
            Project.organization_id == org_id,
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Si un modèle spécifique est demandé, filtrer
    extra = {}
    if model:
        extra["model"] = model

    summary = await enqueue_scan(project_id, specific_model=model)
    await log_action(db, current_user.organization_id, current_user.id, "scan.started", "project", project_id, {"enqueued": summary["enqueued"], **extra})

    return {
        "status": "accepted",
        "message": f"Scan enqueued ({summary['enqueued']} jobs)",
        "project_id": project_id,
        "enqueued": summary["enqueued"],
    }


@router.post("/{project_id}/cancel-scan", status_code=status.HTTP_200_OK)
async def cancel_scan(
    project_id: str,
    current_user: User = Depends(get_current_user),
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    """Annule tous les jobs de scan en cours pour un projet."""
    uid = _resolve_uuid(project_id)
    result = await db.execute(
        select(Project).where(
            Project.id == uid,
            Project.organization_id == org_id,
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    job_ids = project.active_scan_jobs
    if not job_ids or len(job_ids) == 0:
        raise HTTPException(status_code=400, detail="Aucun scan en cours")

    # Supprimer les jobs de Redis
    from arq import create_pool
    from arq.connections import RedisSettings
    from app.config import settings as app_settings

    cancelled = 0
    try:
        redis = await create_pool(
            RedisSettings.from_dsn(app_settings.redis_url)
        )
        try:
            for jid in job_ids:
                await redis.delete(f"arq:job:{jid}")
                cancelled += 1
        finally:
            redis.close()
            await redis.wait_closed()
    except Exception as e:
        # Même si Redis échoue, on vide quand même les job_ids
        print(f"[cancel] Redis error: {e}")

    # Vider les job_ids
    project.active_scan_jobs = None
    await db.flush()

    await log_action(db, current_user.organization_id, current_user.id, "scan.cancelled", "project", project_id, {"cancelled": cancelled})

    return {"status": "cancelled", "cancelled": cancelled, "project_id": project_id}


@router.get("/{project_id}/results", response_model=list[ScanResultResponse])
async def list_results(
    project_id: str,
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Return historical scan results for a project, most recent first."""
    uid = _resolve_uuid(project_id)
    # Verify project belongs to org
    result = await db.execute(
        select(Project).where(
            Project.id == uid,
            Project.organization_id == org_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    results = await db.execute(
        select(ScanResult)
        .where(ScanResult.project_id == uid)
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
    uid = _resolve_uuid(project_id)
    # Verify project belongs to org
    result = await db.execute(
        select(Project).where(
            Project.id == uid,
            Project.organization_id == org_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    # Get the latest scanned_at timestamp
    latest_time_result = await db.execute(
        select(func.max(ScanResult.scanned_at))
        .where(ScanResult.project_id == uid)
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
            ScanResult.project_id == uid,
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
