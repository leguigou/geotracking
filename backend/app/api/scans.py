"""Scan orchestration and result endpoints."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from arq import create_pool
from arq.connections import RedisSettings
from arq.jobs import Job
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import and_, case, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_organization, get_current_user
from app.models.project import Project, Prompt
from app.models.scan_result import ScanBatch, ScanResult
from app.models.user import User
from app.services.audit import log_action
from app.services.openrouter import resolve_legacy_project_models
from app.services.scan_queue import enqueue_scan
from app.services.scanner import calculate_sov, run_assertions
from app.services.competitor_analytics import aggregate_competitors

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
    competitors: list[dict] = Field(default_factory=list)

class ScanBatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: str
    requested_model: Optional[str] = None
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


class ProviderStats(BaseModel):
    sov: float
    mentions: int
    total: int
    failed: int = 0
    url_found: int = 0
    brand_found: int = 0
    latest_at: Optional[datetime] = None


def _rate(value: int, denominator: int) -> float:
    return round(value / denominator * 100, 1) if denominator else 0.0


def _prompt_stats_payload(row) -> dict:
    total = int(row.total or 0)
    failed = int(row.failed or 0)
    successful = max(0, total - failed)
    mentions = int(row.mentions or 0)
    url_found = int(row.url_found or 0)
    brand_found = int(row.brand_found or 0)
    return {
        "total": total,
        "successful": successful,
        "failed": failed,
        "mentions": mentions,
        "mention_rate": _rate(mentions, successful),
        "url_found": url_found,
        "url_rate": _rate(url_found, successful),
        "brand_found": brand_found,
        "brand_rate": _rate(brand_found, successful),
        "average_rank": round(float(row.average_rank), 1) if row.average_rank is not None else None,
        "average_latency_ms": round(float(row.average_latency_ms)) if row.average_latency_ms is not None else None,
        "tokens_used": int(row.tokens_used or 0),
        "cost": round(float(row.cost or 0), 6),
        "first_scan_at": row.first_scan_at.isoformat() if row.first_scan_at else None,
        "last_scan_at": row.last_scan_at.isoformat() if row.last_scan_at else None,
    }


class LatestScanResponse(BaseModel):
    batch: ScanBatchResponse
    scan_date: datetime
    overall: dict[str, float]
    provider_stats: dict[str, ProviderStats]
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


async def _project_competitor_analytics(
    db: AsyncSession,
    project: Project,
) -> dict:
    result = await db.execute(
        select(ScanResult, Prompt)
        .join(Prompt, Prompt.id == ScanResult.prompt_id)
        .where(
            ScanResult.project_id == project.id,
            Prompt.project_id == project.id,
        )
        .order_by(desc(ScanResult.scanned_at))
    )
    return aggregate_competitors(project, list(result.all()))


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
    project = await _owned_project(db, uid, org_id)
    result = await db.execute(
        select(ScanResult, Prompt.text)
        .join(Prompt, Prompt.id == ScanResult.prompt_id)
        .outerjoin(ScanBatch, ScanBatch.id == ScanResult.batch_id)
        .where(ScanResult.project_id == uid)
        .order_by(
            desc(ScanBatch.created_at),
            desc(ScanResult.scanned_at),
            desc(ScanResult.id),
        )
        .offset(offset)
        .limit(limit)
    )
    rows = []
    for scan, prompt_text in result.all():
        competitors = []
        if scan.response_text:
            competitors = [
                competitor
                for competitor in run_assertions(
                    scan.response_text,
                    project.target_url,
                    project.brand_names or [],
                    include_competitors=True,
                ).get("competitors", [])
                if not competitor["is_target"]
            ]
        rows.append(
            {
                **ScanResultResponse.model_validate(scan).model_dump(),
                "prompt_text": prompt_text,
                "competitors": competitors,
            }
        )
    return rows


@router.get("/{project_id}/scan/status")
async def get_scan_status(
    project_id: str,
    batch_id: str | None = Query(default=None),
    org_id=Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    """Return scan batch status with per-cell matrix.

    If ``batch_id`` is provided, returns data for that specific batch.
    Otherwise returns the latest batch.
    """
    uid = _resolve_uuid(project_id)
    await _owned_project(db, uid, org_id)

    # Find the requested batch or the latest one
    if batch_id:
        batch_uuid = _resolve_uuid(batch_id)
        batch_result = await db.execute(
            select(ScanBatch).where(ScanBatch.id == batch_uuid, ScanBatch.project_id == uid)
        )
    else:
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
                    comps = run_assertions(
                        result.response_text,
                        project_target_url,
                        project_brands,
                        include_competitors=True,
                    ).get("competitors", [])
                    competitors = [c for c in comps if not c["is_target"]][:10]

                cells[model] = {
                    "status": "completed" if not result.error else "failed",
                    "has_url": result.has_url,
                    "has_brand": result.has_brand,
                    "rank": result.rank,
                    "error": result.error,
                    "latency_ms": result.latency_ms,
                    "tokens_used": result.tokens_used,
                    "cost": result.cost,
                    "scanned_at": result.scanned_at.isoformat() if result.scanned_at else None,
                    "response_snippet": result.response_text if result.response_text else None,
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
            "requested_model": batch.requested_model,
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


def _summarise_results(
    results: list[ScanResult],
    prompts_by_id: dict,
    project: Project | None = None,
) -> tuple[dict, dict, list, SOVStats]:
    model_groups: dict[str, list[ScanResult]] = {}
    prompt_groups: dict[uuid.UUID, list[ScanResult]] = {}
    for result in results:
        model_groups.setdefault(result.model, []).append(result)
        prompt_groups.setdefault(result.prompt_id, []).append(result)

    provider_stats = {
        model: {
            "sov": calculate_sov(sum(1 for item in items if item.has_url or item.has_brand), len(items)),
            "mentions": sum(1 for item in items if item.has_url or item.has_brand),
            "total": len(items),
            "failed": sum(1 for item in items if item.error),
            "url_found": sum(1 for item in items if item.has_url),
            "brand_found": sum(1 for item in items if item.has_brand),
            "latest_at": max((item.scanned_at for item in items if item.scanned_at), default=None),
        }
        for model, items in model_groups.items()
    }
    overall = {provider: stats["sov"] for provider, stats in provider_stats.items()}
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
            model = item.model
            mentioned = item.has_url or item.has_brand
            competitors = []
            if project and item.response_text:
                competitors = [
                    competitor
                    for competitor in run_assertions(
                        item.response_text,
                        project.target_url,
                        project.brand_names or [],
                        include_competitors=True,
                    ).get("competitors", [])
                    if not competitor["is_target"]
                ][:10]
            models[model] = {
                "model": item.model,
                "mentioned": mentioned,
                "has_url": item.has_url,
                "has_brand": item.has_brand,
                "rank": item.rank,
                "error": item.error,
                "competitors": competitors,
            }
            row[model] = mentioned
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
    return overall, provider_stats, prompts, sov


@router.get("/{project_id}/competitors")
async def list_project_competitors(
    project_id: str,
    search: str | None = Query(default=None, max_length=200),
    sort: str = Query(default="mentions", pattern="^(mentions|recent|rank|name)$"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    org_id=Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    """All competitors detected across the complete project scan history."""
    project_uid = _resolve_uuid(project_id)
    project = await _owned_project(db, project_uid, org_id)
    analytics = await _project_competitor_analytics(db, project)
    competitors = analytics.pop("competitors")

    if search and (term := search.strip().casefold()):
        competitors = [
            item for item in competitors
            if term in item["name"].casefold()
            or any(term in url.casefold() for url in item["urls"])
            or any(term in model["model"].casefold() for model in item["models"])
        ]
    if sort == "recent":
        competitors.sort(key=lambda item: item["last_detected_at"] or "", reverse=True)
    elif sort == "rank":
        competitors.sort(key=lambda item: (item["best_rank"] is None, item["best_rank"] or 999, -item["mentions"]))
    elif sort == "name":
        competitors.sort(key=lambda item: item["name"].casefold())
    else:
        competitors.sort(key=lambda item: (-item["mentions"], item["name"].casefold()))

    total = len(competitors)
    page = []
    for competitor in competitors[offset:offset + limit]:
        summary = {key: value for key, value in competitor.items() if key != "occurrences"}
        page.append(summary)
    return {
        **analytics,
        "items": page,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{project_id}/competitors/detail")
async def get_project_competitor_detail(
    project_id: str,
    key: str = Query(min_length=3, max_length=500),
    org_id=Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    """Every exact occurrence of one competitor with prompt/model/date context."""
    project_uid = _resolve_uuid(project_id)
    project = await _owned_project(db, project_uid, org_id)
    analytics = await _project_competitor_analytics(db, project)
    competitor = next(
        (item for item in analytics["competitors"] if item["key"] == key),
        None,
    )
    if not competitor:
        raise HTTPException(status_code=404, detail="Competitor not found")
    return competitor


@router.get("/{project_id}/prompts/{prompt_id}/stats")
async def get_prompt_stats(
    project_id: str,
    prompt_id: str,
    org_id=Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    """Detailed historical performance for one prompt, loaded on demand."""
    project_uid = _resolve_uuid(project_id)
    prompt_uid = _resolve_uuid(prompt_id)
    await _owned_project(db, project_uid, org_id)
    prompt_result = await db.execute(
        select(Prompt).where(Prompt.id == prompt_uid, Prompt.project_id == project_uid)
    )
    prompt = prompt_result.scalar_one_or_none()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    failed_case = case((ScanResult.error.is_not(None), 1), else_=0)
    mention_case = case((or_(ScanResult.has_url.is_(True), ScanResult.has_brand.is_(True)), 1), else_=0)
    url_case = case((ScanResult.has_url.is_(True), 1), else_=0)
    brand_case = case((ScanResult.has_brand.is_(True), 1), else_=0)
    aggregate_columns = (
        func.count(ScanResult.id).label("total"),
        func.sum(failed_case).label("failed"),
        func.sum(mention_case).label("mentions"),
        func.sum(url_case).label("url_found"),
        func.sum(brand_case).label("brand_found"),
        func.avg(ScanResult.rank).label("average_rank"),
        func.avg(ScanResult.latency_ms).label("average_latency_ms"),
        func.sum(ScanResult.tokens_used).label("tokens_used"),
        func.sum(ScanResult.cost).label("cost"),
        func.min(ScanResult.scanned_at).label("first_scan_at"),
        func.max(ScanResult.scanned_at).label("last_scan_at"),
    )
    filters = (
        ScanResult.project_id == project_uid,
        ScanResult.prompt_id == prompt_uid,
    )

    overall_result = await db.execute(select(*aggregate_columns).where(*filters))
    overall = _prompt_stats_payload(overall_result.one())

    by_model_result = await db.execute(
        select(ScanResult.model, *aggregate_columns)
        .where(*filters)
        .group_by(ScanResult.model)
        .order_by(desc(func.max(ScanResult.scanned_at)))
    )
    by_model = [
        {"model": row.model, **_prompt_stats_payload(row)}
        for row in by_model_result.all()
    ]

    recent_result = await db.execute(
        select(ScanResult)
        .where(*filters)
        .order_by(desc(ScanResult.scanned_at), desc(ScanResult.id))
        .limit(10)
    )
    recent = [
        {
            "id": str(result.id),
            "batch_id": str(result.batch_id) if result.batch_id else None,
            "model": result.model,
            "mentioned": bool(result.has_url or result.has_brand),
            "has_url": result.has_url,
            "has_brand": result.has_brand,
            "rank": result.rank,
            "latency_ms": result.latency_ms,
            "tokens_used": result.tokens_used,
            "cost": result.cost,
            "error": result.error,
            "scanned_at": result.scanned_at.isoformat() if result.scanned_at else None,
        }
        for result in recent_result.scalars().all()
    ]
    return {
        "prompt": {
            "id": str(prompt.id),
            "text": prompt.text,
            "theme": prompt.theme,
            "is_active": prompt.is_active,
            "created_at": prompt.created_at.isoformat() if prompt.created_at else None,
        },
        "overall": overall,
        "by_model": by_model,
        "recent": recent,
    }


@router.get("/{project_id}/results/latest", response_model=LatestScanResponse)
async def get_latest_results(
    project_id: str,
    org_id=Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    uid = _resolve_uuid(project_id)
    project = await _owned_project(db, uid, org_id)
    batch_result = await db.execute(
        select(ScanBatch).where(ScanBatch.project_id == uid).order_by(desc(ScanBatch.created_at)).limit(1)
    )
    batch = batch_result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="No scan batch found for this project")

    # Build a stable dashboard snapshot: the latest available batch for each
    # exact model. A targeted refresh then updates only that model without
    # erasing the latest known results of the others.
    model_batches = (
        select(
            ScanResult.model.label("model"),
            ScanResult.batch_id.label("batch_id"),
            func.max(ScanBatch.created_at).label("batch_created_at"),
        )
        .join(ScanBatch, ScanBatch.id == ScanResult.batch_id)
        .where(
            ScanResult.project_id == uid,
            ScanBatch.status.in_(("completed", "failed", "cancelled")),
        )
        .group_by(ScanResult.model, ScanResult.batch_id)
        .subquery()
    )
    ranked_model_batches = (
        select(
            model_batches.c.model,
            model_batches.c.batch_id,
            func.row_number().over(
                partition_by=model_batches.c.model,
                order_by=(
                    model_batches.c.batch_created_at.desc(),
                    model_batches.c.batch_id.desc(),
                ),
            ).label("batch_rank"),
        )
        .subquery()
    )
    pair_query = select(
        ranked_model_batches.c.model,
        ranked_model_batches.c.batch_id,
    ).where(
        ranked_model_batches.c.batch_rank == 1,
    )
    if project.enabled_models:
        pair_query = pair_query.where(ranked_model_batches.c.model.in_(project.enabled_models))
    latest_pairs = list((await db.execute(pair_query)).all())

    results: list[ScanResult] = []
    if latest_pairs:
        pair_filters = [
            and_(ScanResult.model == model, ScanResult.batch_id == batch_id)
            for model, batch_id in latest_pairs
        ]
        results_result = await db.execute(
            select(ScanResult)
            .where(or_(*pair_filters))
            .order_by(ScanResult.model, ScanResult.prompt_id)
        )
        results = list(results_result.scalars().all())
    prompt_ids = {result.prompt_id for result in results}
    prompts_by_id = {}
    if prompt_ids:
        prompt_result = await db.execute(select(Prompt).where(Prompt.id.in_(prompt_ids)))
        prompts_by_id = {prompt.id: prompt for prompt in prompt_result.scalars().all()}

    overall, provider_stats, prompts, sov = _summarise_results(results, prompts_by_id, project)
    return LatestScanResponse(
        batch=batch,
        scan_date=max(
            (result.scanned_at for result in results if result.scanned_at),
            default=batch.completed_at or batch.created_at,
        ),
        overall=overall,
        provider_stats=provider_stats,
        prompts=prompts,
        results=results,
        sov=sov,
    )


@router.get("/{project_id}/history")
async def get_scan_history(
    project_id: str,
    org_id=Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(100, ge=1, le=1000),
):
    uid = _resolve_uuid(project_id)
    await _owned_project(db, uid, org_id)
    batch_result = await db.execute(
        select(ScanBatch)
        .where(ScanBatch.project_id == uid, ScanBatch.status.in_(("completed", "failed", "cancelled")))
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
    for batch in batches:
        results = results_by_batch[batch.id]
        overall, provider_stats, _, _ = _summarise_results(results, {})
        history.append(
            {
                "batch_id": str(batch.id),
                "scan_date": (batch.completed_at or batch.created_at).isoformat(),
                "status": batch.status,
                "total_jobs": batch.total_jobs,
                "completed_jobs": batch.completed_jobs,
                "failed_jobs": batch.failed_jobs,
                "provider_stats": provider_stats,
                **overall,
            }
        )
    return history
