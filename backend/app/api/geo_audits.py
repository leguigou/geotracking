"""On-demand GEO audits for public web pages."""

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.audit import log_action
from app.services.geo_audit import AuditFetchError, audit_url
from app.api.settings import _assistant_config, _call_assistant


router = APIRouter(prefix="/geo-audits", tags=["geo-audits"])


class GeoAuditRequest(BaseModel):
    url: str = Field(min_length=3, max_length=2048)
    brand: str = Field(default="", max_length=255)
    use_ai: bool = True


@router.post("")
async def create_geo_audit(
    req: GeoAuditRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        report = await audit_url(req.url, req.brand)
    except AuditFetchError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Impossible d’analyser cette URL : {str(exc)[:200]}",
        ) from exc

    report["ai_summary"] = None
    report["ai_model"] = None
    report["ai_warning"] = None
    if req.use_ai:
        try:
            api_key, model = await _assistant_config(db, current_user.organization_id)
            compact_report = {
                "url": report["final_url"],
                "brand": report["brand"],
                "score": report["score"],
                "page": report["page"],
                "robots": report["robots"],
                "sitemap": report["sitemap"],
                "findings": report["findings"],
            }
            report["ai_summary"] = await _call_assistant(
                api_key,
                model,
                (
                    "Tu es un consultant GEO senior. Rédige en français un résumé exécutif "
                    "autonome, clair et directement compréhensible par un non-spécialiste à "
                    "partir de l’audit fourni. N’invente aucun constat. Explique brièvement le "
                    "score, les principaux freins à la visibilité dans les réponses des LLM, "
                    "puis les trois actions prioritaires et le résultat attendu. Utilise les "
                    "rubriques : Diagnostic global, Priorités immédiates, Cap des 30 jours. "
                    "Reste entre 250 et 400 mots et ne recopie pas toute la liste technique."
                ),
                json.dumps(compact_report, ensure_ascii=False)[:30000],
                1400,
            )
            report["ai_model"] = model
        except HTTPException as exc:
            report["ai_warning"] = str(exc.detail)

    await log_action(
        db,
        current_user.organization_id,
        current_user.id,
        "geo_audit.completed",
        "url",
        report["final_url"],
        {
            "score": report["score"],
            "priority_counts": report["priority_counts"],
            "ai_model": report["ai_model"],
        },
    )
    return report
