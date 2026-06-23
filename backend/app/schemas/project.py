"""Project and Prompt schemas."""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProjectCreate(BaseModel):
    name: str
    target_url: str
    brand_names: list[str] = []
    enabled_models: list[str] = []
    frequency: str = "daily"


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    target_url: Optional[str] = None
    brand_names: Optional[list[str]] = None
    enabled_models: Optional[list[str]] = None
    frequency: Optional[str] = None
    is_active: Optional[bool] = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    target_url: str
    brand_names: list[str]
    enabled_models: list[str]
    frequency: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PromptCreate(BaseModel):
    texts: list[str]


class PromptResponse(BaseModel):
    id: str
    project_id: str
    text: str
    created_at: datetime

    class Config:
        from_attributes = True
