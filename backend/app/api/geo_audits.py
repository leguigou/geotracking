"""On-demand GEO audits for public web pages."""

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.geo_audit import GeoAudit
from app.services.audit import log_action
from app.services.geo_audit import AuditFetchError, audit_url
from app.api.settings import _assistant_config, _call_assistant


router = APIRouter(prefix="/geo-audits", tags=["geo-audits"])


class GeoAuditRequest(BaseModel):
    url: str = Field(min_length=3, max_length=2048)
    brand: str = Field(default="", max_length=255)
    use_ai: bool = True


def _audit_id(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Identifiant d’audit invalide") from exc


async def _owned_audit(db: AsyncSession, audit_id: uuid.UUID, organization_id) -> GeoAudit:
    result = await db.execute(
        select(GeoAudit).where(
            GeoAudit.id == audit_id,
            GeoAudit.organization_id == organization_id,
        )
    )
    audit = result.scalar_one_or_none()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit GEO introuvable")
    return audit


async def _generate_and_store(
    req: GeoAuditRequest,
    current_user: User,
    db: AsyncSession,
    source_audit_id: uuid.UUID | None = None,
) -> dict:
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
    report["use_ai"] = req.use_ai
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

    stored_audit = GeoAudit(
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        source_audit_id=source_audit_id,
        requested_url=req.url.strip(),
        final_url=report["final_url"],
        brand=report["brand"],
        use_ai=req.use_ai,
        score=float(report["score"]),
        ai_model=report["ai_model"],
        report=report,
        created_at=datetime.now(timezone.utc),
    )
    db.add(stored_audit)
    await db.flush()
    await db.refresh(stored_audit)

    await log_action(
        db,
        current_user.organization_id,
        current_user.id,
        "geo_audit.completed",
        "geo_audit",
        str(stored_audit.id),
        {
            "url": report["final_url"],
            "score": report["score"],
            "priority_counts": report["priority_counts"],
            "ai_model": report["ai_model"],
            "source_audit_id": str(source_audit_id) if source_audit_id else None,
        },
    )
    return {
        **report,
        "audit_id": str(stored_audit.id),
        "source_audit_id": str(source_audit_id) if source_audit_id else None,
        "saved_at": stored_audit.created_at.isoformat() if stored_audit.created_at else report["generated_at"],
    }


@router.post("")
async def create_geo_audit(
    req: GeoAuditRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _generate_and_store(req, current_user, db)


@router.get("")
async def list_geo_audits(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    filters = (GeoAudit.organization_id == current_user.organization_id,)
    total = int((await db.execute(select(func.count(GeoAudit.id)).where(*filters))).scalar_one())
    result = await db.execute(
        select(GeoAudit)
        .where(*filters)
        .order_by(desc(GeoAudit.created_at), desc(GeoAudit.id))
        .offset(offset)
        .limit(limit)
    )
    items = [
        {
            "audit_id": str(audit.id),
            "source_audit_id": str(audit.source_audit_id) if audit.source_audit_id else None,
            "requested_url": audit.requested_url,
            "final_url": audit.final_url,
            "brand": audit.brand,
            "use_ai": audit.use_ai,
            "score": audit.score,
            "ai_model": audit.ai_model,
            "priority_counts": audit.report.get("priority_counts", {}),
            "created_at": audit.created_at.isoformat() if audit.created_at else None,
        }
        for audit in result.scalars().all()
    ]
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/{audit_id}")
async def get_geo_audit(
    audit_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    audit = await _owned_audit(db, _audit_id(audit_id), current_user.organization_id)
    return {
        **audit.report,
        "audit_id": str(audit.id),
        "source_audit_id": str(audit.source_audit_id) if audit.source_audit_id else None,
        "saved_at": audit.created_at.isoformat() if audit.created_at else None,
    }


@router.post("/{audit_id}/rerun")
async def rerun_geo_audit(
    audit_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    source = await _owned_audit(db, _audit_id(audit_id), current_user.organization_id)
    request = GeoAuditRequest(
        url=source.requested_url,
        brand=source.brand,
        use_ai=source.use_ai,
    )
    return await _generate_and_store(request, current_user, db, source_audit_id=source.id)
