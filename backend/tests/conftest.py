import os
import asyncio
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


TEST_DB = Path(__file__).parent / "test_geotrack.db"
if TEST_DB.exists():
    TEST_DB.unlink()

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB.as_posix()}"
os.environ["ENVIRONMENT"] = "test"

from app.main import app  # noqa: E402
from app.database import engine  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client
    asyncio.run(engine.dispose())
    if TEST_DB.exists():
        TEST_DB.unlink()


@pytest.fixture
def account(client):
    import uuid

    suffix = uuid.uuid4().hex[:10]
    response = client.post(
        "/api/auth/register",
        json={
            "email": f"user-{suffix}@example.com",
            "password": "test-password-123",
            "full_name": "Test User",
            "organization_name": f"Org {suffix}",
        },
    )
    assert response.status_code == 201, response.text
    token = response.json()["access_token"]
    return {"headers": {"Authorization": f"Bearer {token}"}, "token": token}


@pytest.fixture
def project(client, account):
    response = client.post(
        "/api/projects",
        headers=account["headers"],
        json={
            "name": "Cabesto",
            "target_url": "https://www.cabesto.com",
            "description": "Projet de test",
            "brand_names": ["Cabesto"],
            "enabled_models": ["openai/gpt-5.4-mini", "anthropic/claude-haiku-4.5"],
            "frequency": "weekly",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()
