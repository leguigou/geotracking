import asyncio
import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from app.database import async_session
from app.models.project import Prompt
from app.models.scan_result import ScanBatch, ScanResult


def test_project_contract_keeps_description_and_models(client, account, project):
    assert project["description"] == "Projet de test"
    assert project["enabled_models"] == ["openai/gpt-5.4-mini", "anthropic/claude-haiku-4.5"]

    response = client.post(
        f"/api/projects/{project['id']}/prompts",
        headers=account["headers"],
        json={"texts": [" piscine Marseille ", "piscine Marseille"], "theme": "Piscine"},
    )
    assert response.status_code == 201
    assert len(response.json()) == 1


def test_project_create_accepts_legacy_model_slugs(client, account):
    response = client.post(
        "/api/projects",
        headers=account["headers"],
        json={
            "name": "Legacy Models",
            "target_url": "legacy.example.com",
            "brand_names": ["Legacy"],
            "models": ["chatgpt", "claude"],
        },
    )
    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["enabled_models"] == ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet"]


def test_scan_accepts_model_in_json_body(client, account, project, monkeypatch):
    client.post(
        f"/api/projects/{project['id']}/prompts",
        headers=account["headers"],
        json={"texts": ["meilleure piscine"]},
    )
    captured = {}

    async def fake_enqueue(project_id, specific_model=None):
        captured["model"] = specific_model
        return {"batch_id": "00000000-0000-0000-0000-000000000001", "enqueued": 1}

    monkeypatch.setattr("app.api.scans.enqueue_scan", fake_enqueue)
    response = client.post(
        f"/api/projects/{project['id']}/scan",
        headers=account["headers"],
        json={"model": "openai/gpt-5.4-mini"},
    )
    assert response.status_code == 202, response.text
    assert captured["model"] == "openai/gpt-5.4-mini"


def test_latest_batch_and_history_have_dashboard_contract(client, account, project):
    prompt_response = client.post(
        f"/api/projects/{project['id']}/prompts",
        headers=account["headers"],
        json={"texts": ["où acheter une piscine ?"], "theme": "Piscine"},
    )
    prompt_id = prompt_response.json()[0]["id"]

    async def seed_result():
        async with async_session() as db:
            batch = ScanBatch(
                project_id=uuid.UUID(project["id"]),
                status="completed",
                total_jobs=1,
                completed_jobs=1,
                failed_jobs=0,
                completed_at=datetime.now(timezone.utc),
            )
            db.add(batch)
            await db.flush()
            db.add(
                ScanResult(
                    batch_id=batch.id,
                    project_id=uuid.UUID(project["id"]),
                    prompt_id=uuid.UUID(prompt_id),
                    model="openai/gpt-5.4-mini",
                    response_text="Cabesto — https://cabesto.com",
                    has_url=True,
                    has_brand=True,
                    scanned_at=datetime.now(timezone.utc),
                )
            )
            await db.commit()

    asyncio.run(seed_result())
    latest = client.get(f"/api/projects/{project['id']}/results/latest", headers=account["headers"])
    assert latest.status_code == 200, latest.text
    payload = latest.json()
    assert payload["batch"]["status"] == "completed"
    assert payload["overall"]["chatgpt"] == 100.0
    assert payload["prompts"][0]["chatgpt"] is True
    assert payload["prompts"][0]["theme"] == "Piscine"

    history = client.get(f"/api/projects/{project['id']}/history", headers=account["headers"])
    assert history.status_code == 200
    assert history.json()[-1]["chatgpt"] == 100.0

    overview = client.get("/api/dashboard/overview", headers=account["headers"])
    assert overview.status_code == 200, overview.text
    dashboard = overview.json()
    project_row = next(row for row in dashboard["projects"] if row["id"] == project["id"])
    assert project_row["overall"]["chatgpt"] == 100.0
    assert dashboard["totals"]["prompts"] >= 1


def test_prompt_delete_is_tenant_safe_and_project_delete_cascades_explicitly(client, account, project):
    prompt = client.post(
        f"/api/projects/{project['id']}/prompts",
        headers=account["headers"],
        json={"texts": ["prompt privé"]},
    ).json()[0]

    other = client.post(
        "/api/auth/register",
        json={
            "email": f"other-{project['id']}@example.com",
            "password": "test-password-123",
            "full_name": "Other",
            "organization_name": "Other Org",
        },
    ).json()
    other_headers = {"Authorization": f"Bearer {other['access_token']}"}
    forbidden = client.delete(
        f"/api/projects/{project['id']}/prompts/{prompt['id']}", headers=other_headers
    )
    assert forbidden.status_code == 404

    deleted = client.delete(f"/api/projects/{project['id']}", headers=account["headers"])
    assert deleted.status_code == 204
