"""Settings API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Dict

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.setting import Setting

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    settings: Dict[str, str]


@router.get("")
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Setting).where(Setting.organization_id == current_user.organization_id)
    )
    settings_list = result.scalars().all()
    return {s.key: s.value for s in settings_list}


@router.put("")
async def update_settings(
    req: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user.organization_id
    for key, value in req.settings.items():
        result = await db.execute(
            select(Setting).where(
                Setting.organization_id == org_id,
                Setting.key == key,
            )
        )
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = value
        else:
            setting = Setting(organization_id=org_id, key=key, value=value)
            db.add(setting)
    await db.flush()

    # Return updated settings
    result = await db.execute(
        select(Setting).where(Setting.organization_id == org_id)
    )
    settings_list = result.scalars().all()
    return {s.key: s.value for s in settings_list}
