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
from app.models.project import Project, Prompt
from app.models.scan_result import ScanResult
from app.services.scan_queue import enqueue_scan, cancel_scan_jobs
from app.services.scanner import calculate_sov

router = APIRouter(prefix="/projects", tags=["scans"])


# ---------------------------------------------------------------------------
# Pydantic response schemas
# ---------------------------------------------------------------------------

class ScanResultResponse(BaseModel):
    id: str
    project_id: str
    prompt_id: str
    model: str
    has_url: bool
    has_brand: bool
    rank: Optional[int] = None
    latency_ms: Optional[int] = None
    tokens_used: Optional[int] = None
    cost: Optional[float] = None
    note: Optional[str] = None
    has_changes: bool = False
    scanned_at: datetime

    class Config:
        from_attributes = True


class ScanResultDetailResponse(ScanResultResponse):
    """Full response including the LLM answer text and prompt text."""
    response_text: str = ""
    prompt_text: str = ""


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


class UpdateScanNoteRequest(BaseModel):
    note: Optional[str] = None
    has_changes: Optional[bool] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/{project_id}/scan", status_code=status.HTTP_202_ACCEPTED)
async def trigger_scan(
    project_id: str,
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
    body: Optional[dict] = None,
):
    """Manually trigger a scan for all prompts in a project.

    Optionally pass ``{"model": "openai/gpt-4o-mini"}`` in the request body
    to scan with a specific model only (otherwise uses project's enabled_models).

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

    specific_model = None
    if body and isinstance(body, dict):
        specific_model = body.get("model")

    summary = await enqueue_scan(project_id, specific_model=specific_model)
    return {
        "status": "accepted",
        "message": f"Scan enqueued ({summary['enqueued']} jobs)",
        "project_id": project_id,
        "enqueued": summary["enqueued"],
    }


@router.post("/{project_id}/cancel-scan")
async def cancel_scan(
    project_id: str,
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    """Annule tous les scans en cours pour un projet."""
    # Verify the project belongs to this org
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.organization_id == org_id,
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    cancelled = await cancel_scan_jobs(project_id)
    return {
        "status": "cancelled" if cancelled > 0 else "none",
        "cancelled": cancelled,
        "message": f"{cancelled} job(s) annulé(s)" if cancelled > 0 else "Aucun job actif à annuler",
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


@router.get("/{project_id}/results/{result_id}", response_model=ScanResultDetailResponse)
async def get_result_detail(
    project_id: str,
    result_id: str,
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    """Return the full detail of a single scan result, including response text."""
    # Verify project belongs to org
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.organization_id == org_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    # Fetch the scan result with joined prompt
    scan_result = await db.execute(
        select(ScanResult).where(
            ScanResult.id == result_id,
            ScanResult.project_id == project_id,
        )
    )
    sr = scan_result.scalar_one_or_none()
    if not sr:
        raise HTTPException(status_code=404, detail="Scan result not found")

    prompt_text = sr.prompt.text if sr.prompt else ""

    return ScanResultDetailResponse(
        id=str(sr.id),
        project_id=str(sr.project_id),
        prompt_id=str(sr.prompt_id),
        model=sr.model,
        response_text=sr.response_text,
        prompt_text=prompt_text,
        has_url=sr.has_url,
        has_brand=sr.has_brand,
        rank=sr.rank,
        latency_ms=sr.latency_ms,
        tokens_used=sr.tokens_used,
        cost=sr.cost,
        note=sr.note,
        has_changes=sr.has_changes,
        scanned_at=sr.scanned_at,
    )


@router.patch("/{project_id}/results/{result_id}", response_model=ScanResultResponse)
async def update_scan_result(
    project_id: str,
    result_id: str,
    req: UpdateScanNoteRequest,
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    """Update the note and/or has_changes flag on a scan result."""
    # Verify project belongs to org
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.organization_id == org_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    scan_result = await db.execute(
        select(ScanResult).where(
            ScanResult.id == result_id,
            ScanResult.project_id == project_id,
        )
    )
    sr = scan_result.scalar_one_or_none()
    if not sr:
        raise HTTPException(status_code=404, detail="Scan result not found")

    if req.note is not None:
        sr.note = req.note
    if req.has_changes is not None:
        sr.has_changes = req.has_changes

    await db.flush()
    await db.refresh(sr)
    return sr
