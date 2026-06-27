"""Audit log API — voir l'historique des actions."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import String, cast, desc, func, or_, select

from app.database import get_db
from app.dependencies import get_current_organization
from app.models.user import User
from app.models.audit_log import AuditLog

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("")
async def list_audit_logs(
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    action: str | None = None,
    resource_type: str | None = None,
    search: str | None = Query(None, max_length=200),
):
    """Liste paginée des logs d'audit de l'organisation."""
    filters = [AuditLog.organization_id == org_id]
    if action:
        filters.append(AuditLog.action == action)
    if resource_type:
        filters.append(AuditLog.resource_type == resource_type)
    if search and (term := search.strip()):
        pattern = f"%{term}%"
        filters.append(or_(
            AuditLog.action.ilike(pattern),
            AuditLog.resource_type.ilike(pattern),
            AuditLog.resource_id.ilike(pattern),
            AuditLog.ip_address.ilike(pattern),
            User.email.ilike(pattern),
            User.full_name.ilike(pattern),
            cast(AuditLog.details, String).ilike(pattern),
        ))

    query = (
        select(AuditLog, User)
        .outerjoin(User, User.id == AuditLog.user_id)
        .where(*filters)
    )
    query = query.order_by(desc(AuditLog.created_at), desc(AuditLog.id)).offset(offset).limit(limit)
    result = await db.execute(query)
    logs = result.all()

    count_query = (
        select(func.count(AuditLog.id))
        .select_from(AuditLog)
        .outerjoin(User, User.id == AuditLog.user_id)
        .where(*filters)
    )
    total = int((await db.execute(count_query)).scalar_one())

    return {
        "items": [
            {
                "id": str(log.id),
                "organization_id": str(log.organization_id),
                "user_id": str(log.user_id),
                "user_email": user.email if user else None,
                "user_name": user.full_name if user else None,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "details": log.details,
                "ip_address": log.ip_address,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log, user in logs
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }
