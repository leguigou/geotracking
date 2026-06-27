"""Aggregate competitor detections from stored LLM scan responses."""

from __future__ import annotations

import re
from collections import defaultdict
from urllib.parse import urlparse

from app.services.scanner import run_assertions


def _normalise_name(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().casefold()


def _domain(value: str | None) -> str:
    if not value:
        return ""
    parsed = urlparse(value if "://" in value else f"https://{value}")
    return (parsed.hostname or "").lower().removeprefix("www.")


def competitor_key(name: str, url: str | None) -> str:
    domain = _domain(url)
    return f"domain:{domain}" if domain else f"name:{_normalise_name(name)}"


def _evidence_excerpt(response_text: str, name: str, url: str | None) -> str:
    compact = re.sub(r"\s+", " ", response_text).strip()
    needles = [name, _domain(url)]
    index = next(
        (compact.casefold().find(needle.casefold()) for needle in needles if needle and needle.casefold() in compact.casefold()),
        -1,
    )
    if index < 0:
        return compact[:240]
    start = max(0, index - 90)
    end = min(len(compact), index + max(len(name), 20) + 150)
    return f"{'…' if start else ''}{compact[start:end]}{'…' if end < len(compact) else ''}"


def aggregate_competitors(project, rows: list[tuple]) -> dict:
    """Return project-level competitor summaries and all occurrence metadata."""
    entries: dict[str, dict] = {}
    scanned_responses = 0
    prompts_with_competitors: set[str] = set()
    models_seen: set[str] = set()
    total_occurrences = 0

    for result, prompt in rows:
        if result.error or not result.response_text:
            continue
        scanned_responses += 1
        models_seen.add(result.model)
        assertions = run_assertions(
            result.response_text,
            project.target_url,
            project.brand_names or [],
            include_competitors=True,
        )
        detections = [item for item in assertions.get("competitors", []) if not item["is_target"]]
        if detections:
            prompts_with_competitors.add(str(prompt.id))
        for detection in detections:
            name = str(detection.get("name") or "").strip()
            if not name:
                continue
            url = detection.get("url")
            normalised_name = _normalise_name(name)
            key = next(
                (
                    existing_key
                    for existing_key, existing in entries.items()
                    if _normalise_name(existing["name"]) == normalised_name
                ),
                competitor_key(name, url),
            )
            entry = entries.setdefault(
                key,
                {
                    "key": key,
                    "name": name,
                    "urls": set(),
                    "occurrences": [],
                    "prompt_ids": set(),
                    "models": defaultdict(lambda: {
                        "mentions": 0,
                        "prompt_ids": set(),
                        "ranks": [],
                        "first_detected_at": None,
                        "last_detected_at": None,
                    }),
                    "ranks": [],
                    "first_detected_at": None,
                    "last_detected_at": None,
                },
            )
            # Prefer a human-readable label over a raw domain.
            if "." in entry["name"] and "." not in name:
                entry["name"] = name
            if url:
                entry["urls"].add(url)
            scanned_at = result.scanned_at
            timestamp = scanned_at.isoformat() if scanned_at else None
            rank = detection.get("rank")
            if rank is not None:
                entry["ranks"].append(int(rank))
            entry["prompt_ids"].add(str(prompt.id))
            entry["first_detected_at"] = min(
                filter(None, (entry["first_detected_at"], timestamp)),
                default=None,
            )
            entry["last_detected_at"] = max(
                filter(None, (entry["last_detected_at"], timestamp)),
                default=None,
            )
            model_stats = entry["models"][result.model]
            model_stats["mentions"] += 1
            model_stats["prompt_ids"].add(str(prompt.id))
            if rank is not None:
                model_stats["ranks"].append(int(rank))
            model_stats["first_detected_at"] = min(
                filter(None, (model_stats["first_detected_at"], timestamp)),
                default=None,
            )
            model_stats["last_detected_at"] = max(
                filter(None, (model_stats["last_detected_at"], timestamp)),
                default=None,
            )
            entry["occurrences"].append({
                "result_id": str(result.id),
                "batch_id": str(result.batch_id) if result.batch_id else None,
                "prompt_id": str(prompt.id),
                "prompt_text": prompt.text,
                "theme": prompt.theme,
                "model": result.model,
                "name": name,
                "url": url,
                "rank": rank,
                "scanned_at": timestamp,
                "evidence": _evidence_excerpt(result.response_text, name, url),
            })
            total_occurrences += 1

    summaries: list[dict] = []
    for entry in entries.values():
        occurrences = sorted(
            entry["occurrences"],
            key=lambda item: item["scanned_at"] or "",
            reverse=True,
        )
        model_stats = []
        for model, stats in entry["models"].items():
            ranks = stats["ranks"]
            model_stats.append({
                "model": model,
                "mentions": stats["mentions"],
                "prompt_count": len(stats["prompt_ids"]),
                "best_rank": min(ranks) if ranks else None,
                "average_rank": round(sum(ranks) / len(ranks), 1) if ranks else None,
                "first_detected_at": stats["first_detected_at"],
                "last_detected_at": stats["last_detected_at"],
            })
        model_stats.sort(key=lambda item: (-item["mentions"], item["model"]))
        ranks = entry["ranks"]
        mentions = len(occurrences)
        summaries.append({
            "key": entry["key"],
            "name": entry["name"],
            "urls": sorted(entry["urls"]),
            "mentions": mentions,
            "detection_rate": round(mentions / scanned_responses * 100, 1) if scanned_responses else 0.0,
            "share_of_competitor_mentions": round(mentions / total_occurrences * 100, 1) if total_occurrences else 0.0,
            "prompt_count": len(entry["prompt_ids"]),
            "model_count": len(entry["models"]),
            "best_rank": min(ranks) if ranks else None,
            "average_rank": round(sum(ranks) / len(ranks), 1) if ranks else None,
            "first_detected_at": entry["first_detected_at"],
            "last_detected_at": entry["last_detected_at"],
            "models": model_stats,
            "occurrences": occurrences,
        })
    summaries.sort(key=lambda item: (-item["mentions"], item["name"].casefold()))
    return {
        "scanned_responses": scanned_responses,
        "total_competitors": len(summaries),
        "total_occurrences": total_occurrences,
        "prompts_with_competitors": len(prompts_with_competitors),
        "models": sorted(models_seen),
        "competitors": summaries,
    }
