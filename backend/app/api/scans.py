"""Scan orchestration and result endpoints."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from arq import create_pool
from arq.connections import RedisSettings
from arq.jobs import Job
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_organization, get_current_user
from app.models.project import Project, Prompt
from app.models.scan_result import ScanBatch, ScanResult
from app.models.user import User
from app.services.audit import log_action
from app.services.openrouter import model_provider_key, resolve_legacy_project_models
from app.services.scan_queue import enqueue_scan
from app.services.scanner import calculate_sov, run_assertions

router = APIRouter(prefix="/projects", tags=["scans"])


def _resolve_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid UUID: '{value}'")


class ScanRequest(BaseModel):
    model: str | None = None


class ScanResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    batch_id: Optional[uuid.UUID] = None
    project_id: uuid.UUID
    prompt_id: uuid.UUID
    prompt_text: Optional[str] = None
    model: str
    has_url: bool
    has_brand: bool
    rank: Optional[int] = None
    latency_ms: Optional[int] = None
    tokens_used: Optional[int] = None
    cost: Optional[float] = None
    error: Optional[str] = None
    scanned_at: datetime
    response_text: str | None = None

class ScanBatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: str
    total_jobs: int
    completed_jobs: int
    failed_jobs: int
    created_at: datetime
    completed_at: Optional[datetime] = None

class SOVStats(BaseModel):
    total_scans: int
    url_found: int
    brand_found: int
    sov_url: float
    sov_brand: float
    average_rank: Optional[float] = None


class LatestScanResponse(BaseModel):
    batch: ScanBatchResponse
    scan_date: datetime
    overall: dict[str, float]
    prompts: list[dict]
    results: list[ScanResultResponse]
    sov: SOVStats


async def _owned_project(db: AsyncSession, project_id: uuid.UUID, org_id) -> Project:
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.organization_id == org_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("/{project_id}/scan", status_code=status.HTTP_202_ACCEPTED)
async def trigger_scan(
    project_id: str,
    request: ScanRequest | None = Body(default=None),
    model: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    org_id=Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    uid = _resolve_uuid(project_id)
    project = await _owned_project(db, uid, org_id)
    project_models = await resolve_legacy_project_models(db, project)
    await db.commit()
    selected_model = model or (request.model if request else None)

    if selected_model and selected_model not in project_models:
        raise HTTPException(status_code=400, detail="Ce modèle n'est pas activé pour ce projet")

    try:
        summary = await enqueue_scan(str(uid), specific_model=selected_model)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await log_action(
        db,
        current_user.organization_id,
        current_user.id,
        "scan.started",
        "project",
        project_id,
        {"batch_id": summary["batch_id"], "enqueued": summary["enqueued"], "model": selected_model},
    )
    return {
        "status": "accepted",
        "batch_id": summary["batch_id"],
        "project_id": project_id,
        "enqueued": summary["enqueued"],
    }


@router.post("/{project_id}/cancel-scan")
async def cancel_scan(
    project_id: str,
    current_user: User = Depends(get_current_user),
    org_id=Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    uid = _resolve_uuid(project_id)
    project = await _owned_project(db, uid, org_id)
    batch_result = await db.execute(
        select(ScanBatch)
        .where(ScanBatch.project_id == uid, ScanBatch.status.in_(("queued", "running")))
        .order_by(desc(ScanBatch.created_at))
    )
    batch = batch_result.scalars().first()
    if not batch:
        raise HTTPException(status_code=400, detail="Aucun scan en cours")

    redis = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    cancelled = 0
    try:
        for job_id in project.active_scan_jobs or []:
            try:
                await Job(job_id, redis).abort(timeout=2)
                cancelled += 1
            except Exception:
                # A job that already finished is harmless here.
                continue
    finally:
        await redis.close()

    batch.status = "cancelled"
    batch.completed_at = datetime.now(timezone.utc)
    project.active_scan_jobs = None
    await db.flush()
    await log_action(
        db,
        current_user.organization_id,
        current_user.id,
        "scan.cancelled",
        "project",
        project_id,
        {"batch_id": str(batch.id), "cancelled": cancelled},
    )
    return {"status": "cancelled", "batch_id": str(batch.id), "cancelled": cancelled}


@router.get("/{project_id}/results", response_model=list[ScanResultResponse])
async def list_results(
    project_id: str,
    org_id=Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    uid = _resolve_uuid(project_id)
    await _owned_project(db, uid, org_id)
    result = await db.execute(
        select(ScanResult, Prompt.text)
        .join(Prompt, Prompt.id == ScanResult.prompt_id)
        .where(ScanResult.project_id == uid)
        .order_by(desc(ScanResult.scanned_at))
        .offset(offset)
        .limit(limit)
    )
    return [
        {**ScanResultResponse.model_validate(scan).model_dump(), "prompt_text": prompt_text}
        for scan, prompt_text in result.all()
    ]


@router.get("/{project_id}/scan/status")
async def get_scan_status(
    project_id: str,
    org_id=Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    """Return the active (or last) scan batch with per-cell status matrix.

    Returns the current scan batch status and a matrix of
    prompts × models showing each job's status.
    """
    uid = _resolve_uuid(project_id)
    await _owned_project(db, uid, org_id)

    # Find the active batch first, then fall back to the latest
    batch_result = await db.execute(
        select(ScanBatch)
        .where(ScanBatch.project_id == uid)
        .order_by(desc(ScanBatch.created_at))
        .limit(1)
    )
    batch = batch_result.scalar_one_or_none()
    if not batch:
        return {"batch": None, "matrix": [], "prompts": [], "models": []}

    # Fetch all prompts for this project
    prompts_result = await db.execute(
        select(Prompt)
        .where(Prompt.project_id == uid, Prompt.is_active.is_(True))
        .order_by(Prompt.created_at)
    )
    prompts = prompts_result.scalars().all()

    # Get results for this batch
    results_result = await db.execute(
        select(ScanResult).where(ScanResult.batch_id == batch.id)
    )
    results = list(results_result.scalars().all())

    # Build a lookup: (prompt_id, model) -> result
    result_map: dict[tuple[uuid.UUID, str], ScanResult] = {}
    for r in results:
        result_map[(r.prompt_id, r.model)] = r

    # Determine models used in this batch
    models: list[str] = []
    project = await db.get(Project, uid)
    if batch.requested_model:
        models = [batch.requested_model]
    elif project and project.enabled_models:
        models = list(project.enabled_models)

    # Build matrix
    matrix: list[dict] = []
    project_target_url = project.target_url if project else ""
    project_brands = project.brand_names or [] if project else []
    for prompt in prompts:
        row: dict = {
            "prompt_id": str(prompt.id),
            "prompt_text": prompt.text,
            "theme": prompt.theme,
        }
        cells: dict = {}
        for model in models:
            result = result_map.get((prompt.id, model))
            if result:
                # Compute competitors from response_text
                competitors = []
                if result.response_text:
                    comps = run_assertions(result.response_text, project_target_url, project_brands).get("competitors", [])
                    competitors = [c for c in comps if not c["is_target"]][:10]

                cells[model] = {
                    "status": "completed" if not result.error else "failed",
                    "has_url": result.has_url,
                    "has_brand": result.has_brand,
                    "rank": result.rank,
                    "error": result.error,
                    "latency_ms": result.latency_ms,
                    "response_snippet": result.response_text[:300] if result.response_text else None,
                    "competitors": competitors,
                }
            else:
                cells[model] = {"status": "pending", "has_url": False, "has_brand": False}
        row["models"] = cells
        matrix.append(row)

    return {
        "batch": {
            "id": str(batch.id),
            "status": batch.status,
            "total_jobs": batch.total_jobs,
            "completed_jobs": batch.completed_jobs,
            "failed_jobs": batch.failed_jobs,
            "created_at": batch.created_at.isoformat(),
            "completed_at": batch.completed_at.isoformat() if batch.completed_at else None,
        },
        "matrix": matrix,
        "prompts": [{"id": str(p.id), "text": p.text, "theme": p.theme} for p in prompts],
        "models": models,
    }


def _summarise_results(results: list[ScanResult], prompts_by_id: dict) -> tuple[dict, list, SOVStats]:
    provider_groups: dict[str, list[ScanResult]] = {}
    prompt_groups: dict[uuid.UUID, list[ScanResult]] = {}
    for result in results:
        provider_groups.setdefault(model_provider_key(result.model), []).append(result)
        prompt_groups.setdefault(result.prompt_id, []).append(result)

    overall = {
        provider: calculate_sov(sum(1 for item in items if item.has_url or item.has_brand), len(items))
        for provider, items in provider_groups.items()
    }
    prompts = []
    for prompt_id, items in prompt_groups.items():
        prompt = prompts_by_id.get(prompt_id)
        models = {}
        row = {
            "prompt_id": str(prompt_id),
            "prompt_text": prompt.text if prompt else "",
            "theme": prompt.theme if prompt else None,
            "models": models,
        }
        for item in items:
            provider = model_provider_key(item.model)
            mentioned = item.has_url or item.has_brand
            models[provider] = {
                "model": item.model,
                "mentioned": mentioned,
                "has_url": item.has_url,
                "has_brand": item.has_brand,
                "rank": item.rank,
                "error": item.error,
            }
            row[provider] = mentioned
        prompts.append(row)

    total = len(results)
    url_ok = sum(1 for item in results if item.has_url)
    brand_ok = sum(1 for item in results if item.has_brand)
    ranks = [item.rank for item in results if item.rank is not None]
    sov = SOVStats(
        total_scans=total,
        url_found=url_ok,
        brand_found=brand_ok,
        sov_url=calculate_sov(url_ok, total),
        sov_brand=calculate_sov(brand_ok, total),
        average_rank=round(sum(ranks) / len(ranks), 1) if ranks else None,
    )
    return overall, prompts, sov


@router.get("/{project_id}/results/latest", response_model=LatestScanResponse)
async def get_latest_results(
    project_id: str,
    org_id=Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    uid = _resolve_uuid(project_id)
    await _owned_project(db, uid, org_id)
    batch_result = await db.execute(
        select(ScanBatch).where(ScanBatch.project_id == uid).order_by(desc(ScanBatch.created_at)).limit(1)
    )
    batch = batch_result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="No scan batch found for this project")

    results_result = await db.execute(
        select(ScanResult).where(ScanResult.batch_id == batch.id).order_by(ScanResult.model, ScanResult.prompt_id)
    )
    results = list(results_result.scalars().all())
    prompt_ids = {result.prompt_id for result in results}
    prompts_by_id = {}
    if prompt_ids:
        prompt_result = await db.execute(select(Prompt).where(Prompt.id.in_(prompt_ids)))
        prompts_by_id = {prompt.id: prompt for prompt in prompt_result.scalars().all()}

    overall, prompts, sov = _summarise_results(results, prompts_by_id)
    return LatestScanResponse(
        batch=batch,
        scan_date=batch.completed_at or batch.created_at,
        overall=overall,
        prompts=prompts,
        results=results,
        sov=sov,
    )


@router.get("/{project_id}/history")
async def get_scan_history(
    project_id: str,
    org_id=Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(30, ge=1, le=100),
):
    uid = _resolve_uuid(project_id)
    await _owned_project(db, uid, org_id)
    batch_result = await db.execute(
        select(ScanBatch)
        .where(ScanBatch.project_id == uid, ScanBatch.status.in_(("completed", "cancelled")))
        .order_by(desc(ScanBatch.created_at))
        .limit(limit)
    )
    batches = list(batch_result.scalars().all())
    results_by_batch: dict[uuid.UUID, list[ScanResult]] = {batch.id: [] for batch in batches}
    if batches:
        result_rows = await db.execute(
            select(ScanResult).where(ScanResult.batch_id.in_([batch.id for batch in batches]))
        )
        for result in result_rows.scalars().all():
            results_by_batch[result.batch_id].append(result)
    history = []
    for batch in reversed(batches):
        results = results_by_batch[batch.id]
        overall, _, _ = _summarise_results(results, {})
        history.append(
            {
                "batch_id": str(batch.id),
                "scan_date": (batch.completed_at or batch.created_at).isoformat(),
                "status": batch.status,
                "failed_jobs": batch.failed_jobs,
                **overall,
            }
        )
    return history
