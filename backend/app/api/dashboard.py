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
from app.services.scanner import calculate_sov, run_assertions

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _provider_sov(results: list[ScanResult]) -> dict[str, float]:
    return {provider: stats["sov"] for provider, stats in _provider_stats(results).items()}


def _provider_stats(results: list[ScanResult]) -> dict[str, dict]:
    grouped: dict[str, list[ScanResult]] = defaultdict(list)
    for result in results:
        grouped[result.model].append(result)
    return {
        provider: {
            "sov": calculate_sov(sum(1 for item in items if item.has_url or item.has_brand), len(items)),
            "mentions": sum(1 for item in items if item.has_url or item.has_brand),
            "total": len(items),
            "failed": sum(1 for item in items if item.error),
            "url_found": sum(1 for item in items if item.has_url),
            "brand_found": sum(1 for item in items if item.has_brand),
        }
        for provider, items in grouped.items()
    }


def _competitor_counts(project: Project, results: list[ScanResult]) -> dict[str, dict]:
    competitors: dict[str, dict] = {}
    for result in results:
        if not result.response_text:
            continue
        assertions = run_assertions(
            result.response_text,
            project.target_url,
            project.brand_names or [],
            include_competitors=True,
        )
        for competitor in assertions.get("competitors", []):
            if competitor["is_target"]:
                continue
            name = str(competitor["name"]).strip()
            if not name:
                continue
            key = name.lower()
            entry = competitors.setdefault(
                key,
                {
                    "name": name,
                    "url": competitor.get("url"),
                    "mentions": 0,
                    "rank_sum": 0,
                    "rank_count": 0,
                    "projects": set(),
                    "models": set(),
                },
            )
            entry["mentions"] += 1
            entry["projects"].add(project.name)
            entry["models"].add(result.model)
            if competitor.get("rank") is not None:
                entry["rank_sum"] += int(competitor["rank"])
                entry["rank_count"] += 1
            if not entry["url"] and competitor.get("url"):
                entry["url"] = competitor["url"]
    return competitors


def _serialise_competitor(entry: dict) -> dict:
    return {
        "name": entry["name"],
        "url": entry.get("url"),
        "mentions": entry["mentions"],
        "average_rank": round(entry["rank_sum"] / entry["rank_count"], 1) if entry["rank_count"] else None,
        "projects": sorted(entry["projects"]),
        "models": sorted(entry["models"]),
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
            "alerts": [],
            "top_competitors": [],
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
    alerts: list[dict] = []
    competitors: dict[str, dict] = {}
    for project in projects:
        batch = latest_by_project.get(project.id)
        latest_results: list[ScanResult] = []
        seen_models: set[str] = set()
        enabled_models = set(project.enabled_models or [])
        for candidate in (item for item in relevant_batches if item.project_id == project.id):
            candidate_results = results_by_batch.get(candidate.id, [])
            candidate_models = {
                result.model
                for result in candidate_results
                if (not enabled_models or result.model in enabled_models)
                and result.model not in seen_models
            }
            if not candidate_models:
                continue
            latest_results.extend(
                result for result in candidate_results if result.model in candidate_models
            )
            seen_models.update(candidate_models)
        provider_stats = _provider_stats(latest_results) if batch else {}
        overall = {provider: stats["sov"] for provider, stats in provider_stats.items()}
        all_latest_sov.extend(overall.values())
        failed_jobs += batch.failed_jobs if batch else 0
        for key, entry in _competitor_counts(project, latest_results).items():
            current = competitors.setdefault(
                key,
                {
                    "name": entry["name"],
                    "url": entry.get("url"),
                    "mentions": 0,
                    "rank_sum": 0,
                    "rank_count": 0,
                    "projects": set(),
                    "models": set(),
                },
            )
            current["mentions"] += entry["mentions"]
            current["rank_sum"] += entry["rank_sum"]
            current["rank_count"] += entry["rank_count"]
            current["projects"].update(entry["projects"])
            current["models"].update(entry["models"])
            if not current["url"] and entry.get("url"):
                current["url"] = entry["url"]

        project_avg_sov = round(sum(overall.values()) / len(overall), 1) if overall else None
        if project.is_active and not batch:
            alerts.append({
                "severity": "info",
                "project_id": str(project.id),
                "project_name": project.name,
                "message": "Aucun scan encore disponible : lance un premier scan pour créer le point de référence.",
            })
        if batch and batch.failed_jobs:
            alerts.append({
                "severity": "warning",
                "project_id": str(project.id),
                "project_name": project.name,
                "message": f"{batch.failed_jobs} requête(s) OpenRouter ont échoué sur le dernier scan.",
            })
        if project_avg_sov == 0 and latest_results:
            alerts.append({
                "severity": "critical",
                "project_id": str(project.id),
                "project_name": project.name,
                "message": "La marque est absente de toutes les réponses du dernier scan.",
            })
        elif project_avg_sov is not None and project_avg_sov < 25:
            alerts.append({
                "severity": "warning",
                "project_id": str(project.id),
                "project_name": project.name,
                "message": f"SOV faible sur le dernier scan ({project_avg_sov}%). Priorité aux prompts absents.",
            })
        project_summaries.append(
            {
                "id": str(project.id),
                "name": project.name,
                "is_active": project.is_active,
                "prompt_count": int(prompt_counts.get(project.id, 0)),
                "enabled_models": list(project.enabled_models or []),
                "overall": overall,
                "provider_stats": provider_stats,
                "sov_avg": project_avg_sov,
                "batch": {
                    "id": str(batch.id),
                    "status": batch.status,
                    "failed_jobs": batch.failed_jobs,
                    "scan_date": (batch.completed_at or batch.created_at).isoformat(),
                } if batch else None,
            }
        )

    daily_values: dict[str, dict[str, dict[str, int]]] = defaultdict(
        lambda: defaultdict(lambda: {"mentions": 0, "total": 0, "failed": 0})
    )
    for batch in relevant_batches:
        if batch.status != "completed":
            continue
        date_key = (batch.completed_at or batch.created_at).date().isoformat()
        for provider, stats in _provider_stats(results_by_batch.get(batch.id, [])).items():
            daily_values[date_key][provider]["mentions"] += stats["mentions"]
            daily_values[date_key][provider]["total"] += stats["total"]
            daily_values[date_key][provider]["failed"] += stats["failed"]

    trend = []
    for date_key in sorted(daily_values):
        row = {"date": date_key, "provider_stats": {}}
        for provider, stats in daily_values[date_key].items():
            sov = calculate_sov(stats["mentions"], stats["total"])
            row[provider] = sov
            row["provider_stats"][provider] = {
                "sov": sov,
                "mentions": stats["mentions"],
                "total": stats["total"],
                "failed": stats["failed"],
            }
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
        "alerts": alerts[:10],
        "top_competitors": [
            _serialise_competitor(entry)
            for entry in sorted(
                competitors.values(),
                key=lambda item: (-item["mentions"], item["rank_sum"] / item["rank_count"] if item["rank_count"] else 999),
            )[:10]
        ],
    }
