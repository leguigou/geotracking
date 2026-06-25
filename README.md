# GEOTrack AI

GEOTrack mesure la visibilité d'une marque dans les réponses des moteurs IA via OpenRouter. Un projet représente un site, ses prompts sont regroupés par thème et chaque campagne produit un lot de résultats comparable dans le temps.

Le **SOV (Share of Voice)** est la part des réponses dans lesquelles la marque ou le domaine suivi est cité.

## Fonctionnalités

- catalogue OpenRouter en direct avec choix du modèle exact et affichage des tarifs ;
- scans manuels ou planifiés (`daily`, `weekly`, `biweekly`, `monthly`) ;
- lots de scan idempotents, progression, erreurs visibles et reprise des erreurs transitoires ;
- détection des mentions de marque et de domaine, coût et latence par réponse ;
- dashboard consolidé, évolution quotidienne et matrice projets × fournisseurs ;
- matrice prompts × modèles avec cinq états : mentionné, absent, en attente, erreur et non scanné ;
- export CSV et historique des campagnes ;
- isolation des données par organisation.

## Architecture

| Couche | Technologie |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4 |
| API | Python, FastAPI, SQLAlchemy async, Alembic |
| Base | PostgreSQL 16 (SQLite possible pour le développement et les tests) |
| Queue | Redis 7 + ARQ |
| IA | OpenRouter |
| Production | Docker Compose, Nginx, Dokploy/Traefik |

Trois processus backend distincts utilisent la même image :

- `backend` sert l'API et applique les migrations au démarrage ;
- `worker` exécute les appels OpenRouter ;
- `scheduler` programme les scans récurrents à partir de l'état conservé en base.

Les anciens projets configurés avec des alias comme `chatgpt` ou `claude` sont automatiquement convertis vers des identifiants OpenRouter réels.

## Démarrage local

Prérequis : Python 3.11+, Node.js 20+, Redis et une clé OpenRouter configurée dans les paramètres de l'organisation.

```bash
cd backend
python -m venv .venv
# PowerShell : .venv\Scripts\Activate.ps1
pip install -r requirements-dev.lock
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Dans deux autres terminaux backend :

```bash
arq app.services.scan_queue.WorkerSettings
python -m app.services.scheduler
```

Puis le frontend :

```bash
cd frontend
npm ci
npm run dev
```

Le frontend est disponible sur `http://localhost:5173` et transmet `/api` à l'API sur le port 8000.

## Déploiement Docker

```bash
docker compose up -d --build
```

Variables principales :

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | URL SQLAlchemy de PostgreSQL |
| `REDIS_URL` | URL Redis partagée par l'API, le worker et le scheduler |
| `JWT_SECRET` | Secret de signature des jetons |
| `DOKPLOY_EXTERNAL_RESOURCES` | `true` si le réseau et le volume sont déjà gérés par Dokploy |

La clé OpenRouter est enregistrée dans les paramètres de chaque organisation. Les valeurs sensibles et leur stratégie de stockage restent à traiter séparément.

## API utile

| Méthode | Route | Description |
| --- | --- | --- |
| `POST` | `/api/projects/{id}/scan` | Crée ou reprend un lot de scan |
| `GET` | `/api/projects/{id}/results/latest` | Dernier lot, progression et résultats |
| `GET` | `/api/projects/{id}/history` | Historique des lots |
| `GET` | `/api/dashboard/overview` | Métriques consolidées en une requête |
| `GET` | `/api/settings/models` | Catalogue OpenRouter et recommandations |

La documentation interactive complète est disponible sur `/docs` lorsque l'API tourne.

## Qualité

```bash
cd backend
pytest -q --cov=app --cov-fail-under=55

cd ../frontend
npm run lint
npm run build
```

Les tests d'intégration Redis sont activés avec `RUN_REDIS_TESTS=1`. Le test de complétion OpenRouter réel est volontairement optionnel et nécessite `OPENROUTER_TEST_API_KEY`.

## Licence

Propriétaire — Cabesto / Guillaume Deloffre
