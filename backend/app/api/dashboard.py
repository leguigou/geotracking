"""Aggregated dashboard data in a bounded number of database queries."""

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_organization
from app.models.project import Project, Prompt
from app.models.scan_result import ScanBatch, ScanResult
from app.services.openrouter import model_provider_key
from app.services.scanner import calculate_sov

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _provider_sov(results: list[ScanResult]) -> dict[str, float]:
    grouped: dict[str, list[ScanResult]] = defaultdict(list)
    for result in results:
        grouped[model_provider_key(result.model)].append(result)
    return {
        provider: calculate_sov(sum(1 for item in items if item.has_url or item.has_brand), len(items))
        for provider, items in grouped.items()
    }


@router.get("/overview")
async def dashboard_overview(
    org_id=Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    project_rows = await db.execute(
        select(Project).where(Project.organization_id == org_id).order_by(Project.created_at.desc())
    )
    projects = list(project_rows.scalars().all())
    project_ids = [project.id for project in projects]
    if not project_ids:
        return {
            "totals": {"projects": 0, "active_projects": 0, "prompts": 0, "average_sov": 0, "failed_jobs": 0},
            "projects": [],
            "trend": [],
        }

    count_rows = await db.execute(
        select(Prompt.project_id, func.count(Prompt.id))
        .where(Prompt.project_id.in_(project_ids), Prompt.is_active.is_(True))
        .group_by(Prompt.project_id)
    )
    prompt_counts = dict(count_rows.all())

    batch_rows = await db.execute(
        select(ScanBatch)
        .where(ScanBatch.project_id.in_(project_ids))
        .order_by(ScanBatch.project_id, desc(ScanBatch.created_at))
    )
    all_batches = list(batch_rows.scalars().all())
    latest_by_project: dict = {}
    for batch in all_batches:
        latest_by_project.setdefault(batch.project_id, batch)

    recent_cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    latest_ids = {item.id for item in latest_by_project.values()}
    relevant_batches = [
        batch
        for batch in all_batches
        if batch.id in latest_ids
        or (batch.status == "completed" and batch.created_at and batch.created_at.replace(tzinfo=batch.created_at.tzinfo or timezone.utc) >= recent_cutoff)
    ]
    batch_ids = [batch.id for batch in relevant_batches]
    results_by_batch: dict = defaultdict(list)
    if batch_ids:
        result_rows = await db.execute(select(ScanResult).where(ScanResult.batch_id.in_(batch_ids)))
        for result in result_rows.scalars().all():
            results_by_batch[result.batch_id].append(result)

    project_summaries = []
    all_latest_sov: list[float] = []
    failed_jobs = 0
    for project in projects:
        batch = latest_by_project.get(project.id)
        overall = _provider_sov(results_by_batch.get(batch.id, [])) if batch else {}
        all_latest_sov.extend(overall.values())
        failed_jobs += batch.failed_jobs if batch else 0
        project_summaries.append(
            {
                "id": str(project.id),
                "name": project.name,
                "is_active": project.is_active,
                "prompt_count": int(prompt_counts.get(project.id, 0)),
                "overall": overall,
                "batch": {
                    "id": str(batch.id),
                    "status": batch.status,
                    "failed_jobs": batch.failed_jobs,
                    "scan_date": (batch.completed_at or batch.created_at).isoformat(),
                } if batch else None,
            }
        )

    daily_values: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    for batch in relevant_batches:
        if batch.status != "completed":
            continue
        date_key = (batch.completed_at or batch.created_at).date().isoformat()
        for provider, value in _provider_sov(results_by_batch.get(batch.id, [])).items():
            daily_values[date_key][provider].append(value)

    trend = []
    for date_key in sorted(daily_values):
        row = {"date": date_key}
        for provider, values in daily_values[date_key].items():
            row[provider] = round(sum(values) / len(values), 1)
        trend.append(row)

    return {
        "totals": {
            "projects": len(projects),
            "active_projects": sum(1 for project in projects if project.is_active),
            "prompts": sum(prompt_counts.values()),
            "average_sov": round(sum(all_latest_sov) / len(all_latest_sov), 1) if all_latest_sov else 0,
            "failed_jobs": failed_jobs,
        },
        "projects": project_summaries,
        "trend": trend,
    }
