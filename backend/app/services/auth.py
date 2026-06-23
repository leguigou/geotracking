"""Authentication service."""

import uuid
from datetime import datetime, timedelta
import bcrypt
from jose import jwt, JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import Organization, User


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, organization_id: str) -> str:
    now = datetime.utcnow()
    payload = {
        "sub": user_id,
        "org": organization_id,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_access_expire_minutes),
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def create_refresh_token(user_id: str) -> str:
    now = datetime.utcnow()
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(days=settings.jwt_refresh_expire_days),
        "type": "refresh",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return payload
    except JWTError:
        return None


async def register_organization(db: AsyncSession, email: str, password: str, full_name: str, org_name: str) -> User:
    """Create a new organization with the first admin user."""
    org = Organization(
        name=org_name,
        slug=org_name.lower().replace(" ", "-") + "-" + str(uuid.uuid4())[:8],
    )
    db.add(org)
    await db.flush()

    user = User(
        organization_id=org.id,
        email=email,
        password_hash=hash_password(password),
        full_name=full_name,
        role="admin",
    )
    db.add(user)
    await db.flush()
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user and verify_password(password, user.password_hash):
        return user
    return None


async def get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
