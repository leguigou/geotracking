"""Authentication endpoints with HTTP-only cookie for refresh token."""

from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserResponse
from app.services.auth import (
    register_organization,
    authenticate_user,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_NAME = "refresh_token"
COOKIE_PATH = "/api/auth"
COOKIE_MAX_AGE = 30 * 24 * 3600  # 30 jours


def _set_refresh_cookie(response: Response, token: str) -> None:
    """Set refresh token as HTTP-only, secure, SameSite=Lax cookie."""
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=True,
        path=COOKIE_PATH,
    )


def _clear_refresh_cookie(response: Response) -> None:
    """Remove the refresh cookie."""
    response.delete_cookie(
        key=COOKIE_NAME,
        path=COOKIE_PATH,
        httponly=True,
        samesite="lax",
        secure=True,
    )


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(req: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = await register_organization(db, req.email, req.password, req.full_name, req.organization_name)

    access = create_access_token(str(user.id), str(user.organization_id))
    refresh = create_refresh_token(str(user.id))

    _set_refresh_cookie(response, refresh)

    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, req.email, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access = create_access_token(str(user.id), str(user.organization_id))
    refresh = create_refresh_token(str(user.id))

    _set_refresh_cookie(response, refresh)

    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    # Lire le refresh token depuis le cookie HTTP-only
    refresh_token = request.cookies.get(COOKIE_NAME)
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")

    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    result = await db.execute(select(User).where(User.id == payload["sub"]))
    user = result.scalar_one_or_none()
    if not user:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="User not found")

    access = create_access_token(str(user.id), str(user.organization_id))
    refresh = create_refresh_token(str(user.id))

    _set_refresh_cookie(response, refresh)

    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
    )


@router.post("/logout", status_code=204)
async def logout(response: Response):
    """Clear the refresh cookie."""
    _clear_refresh_cookie(response)


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user=Depends(__import__("app.dependencies", fromlist=["get_current_user"]).get_current_user),
):
    return current_user
