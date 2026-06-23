# GEOTrack AI

GEO/LLM Rank Tracker — Suivi de visibilité sur les moteurs de réponses IA.

Stack: React + FastAPI + PostgreSQL + OpenRouter
Deploiement: Docker Compose sur Dokploy

## Developpement

```bash
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload
cd frontend && npm run dev
```

## Production

```bash
docker compose up -d
```
