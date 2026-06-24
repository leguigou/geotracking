"""Projects CRUD endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List, Optional

from app.database import get_db
from app.dependencies import get_current_user, get_current_organization
from app.models.user import User
from app.models.project import Project, Prompt
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    PromptCreate, PromptResponse,
)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.organization_id == org_id).order_by(Project.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    req: ProjectCreate,
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    project = Project(
        organization_id=org_id,
        name=req.name,
        target_url=req.target_url,
        brand_names=req.brand_names,
        enabled_models=req.enabled_models,
        frequency=req.frequency,
    )
    db.add(project)
    await db.flush()
    await db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: uuid.UUID,
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.organization_id == org_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: uuid.UUID,
    req: ProjectUpdate,
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.organization_id == org_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = req.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)

    await db.flush()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: uuid.UUID,
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.organization_id == org_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)


# === Prompts (nested under projects) ===

@router.get("/{project_id}/prompts", response_model=List[PromptResponse])
async def list_prompts(
    project_id: uuid.UUID,
    theme: Optional[str] = None,
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    # Verify project belongs to org
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.organization_id == org_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    query = select(Prompt).where(Prompt.project_id == project_id)
    if theme:
        query = query.where(Prompt.theme == theme)
    query = query.order_by(Prompt.theme, Prompt.created_at)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/{project_id}/prompts", response_model=List[PromptResponse], status_code=201)
async def create_prompts(
    project_id: uuid.UUID,
    req: PromptCreate,
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.organization_id == org_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    prompts = [Prompt(project_id=project_id, text=text, theme=req.theme) for text in req.texts]
    db.add_all(prompts)
    await db.flush()
    return prompts


@router.delete("/{project_id}/prompts/{prompt_id}", status_code=204)
async def delete_prompt(
    project_id: uuid.UUID,
    prompt_id: uuid.UUID,
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Prompt).where(Prompt.id == prompt_id, Prompt.project_id == project_id)
    )
    prompt = result.scalar_one_or_none()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    await db.delete(prompt)
