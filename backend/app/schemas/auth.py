"""Auth request/response schemas."""

import uuid

from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    organization_name: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    organization_id: uuid.UUID
    is_active: bool

    class Config:
        from_attributes = True


class UpdateProfileRequest(BaseModel):
    full_name: str | None = None
    email: str | None = None
    current_password: str | None = None
    new_password: str | None = None
