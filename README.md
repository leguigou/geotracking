# GEOTrack AI

**GEO/LLM Rank Tracker** — Suivez la visibilité de vos sites internet sur les moteurs de réponse IA (ChatGPT, Claude, Perplexity, Gemini, Grok).

## Concept

### Projet = Site Internet

Chaque **projet** représente un site internet dont vous voulez suivre la visibilité.

### Thématiques (groupes de prompts)

Au sein d'un projet, vous organisez vos **questions/prompts** par **thématique** (univers métier, catégorie de produits, etc.). Chaque thématique produit son propre rapport.

```
Cabesto (projet)
├── 🌊 Piscine (thématique)
│   ├── "piscine aubagne"
│   ├── "constructeur piscine 13"
│   └── "prix piscine coque"
├── 🌿 Jardin (thématique)
│   ├── "jardinier paysagiste Aubagne"
│   └── "amenagement terrasse"
└── 👕 Équipement (thématique)
    ├── "vetement securite travail"
    └── "epi bouches du rhone"
```

Les LLMs sont interrogés avec ces questions. Le **SOV (Share of Voice)** mesure le pourcentage de réponses où votre site apparaît.

## Stack

| Couche | Technologie |
|--------|------------|
| **Frontend** | React 20 + TypeScript + Vite + Tailwind CSS v4 |
| **Backend** | Python 3.13 + FastAPI + SQLAlchemy (async) |
| **Base de données** | PostgreSQL 16 |
| **Cache / Queue** | Redis 7 |
| **LLM Router** | OpenRouter (un seul provider, modèle configurable par prompt) |
| **Déploiement** | Docker Compose sur Dokploy (VM OVH) |
| **Proxy** | Traefik (HTTPS via Let's Encrypt) |

## Modèle de données

```
Organization
├── id: UUID
├── name: String
├── slug: String
│
├── User
│   ├── id: UUID
│   ├── email: String
│   ├── password_hash: String
│   ├── role: "admin" | "user"
│   └── organization_id → Organization
│
├── Project (un site internet)
│   ├── id: UUID
│   ├── name: String ("Cabesto")
│   ├── target_url: String ("www.cabesto.com")
│   ├── brand_names: String[] ("Cabesto")
│   ├── enabled_models: String[] ("chatgpt", "claude", ...)
│   ├── frequency: String ("daily")
│   ├── is_active: Boolean
│   └── organization_id → Organization
│
├── Prompt (une question / mot-clé)
│   ├── id: UUID
│   ├── text: String ("piscine aubagne")
│   ├── theme: String? ("Piscine", "Jardin", null)
│   └── project_id → Project
│
└── ScanResult (résultat d'un scan LLM)
    ├── id: UUID
    ├── model: String ("chatgpt")
    ├── response_text: Text
    ├── has_url: Boolean (le site est mentionné ?)
    ├── has_brand: Boolean (la marque est mentionnée ?)
    ├── rank: Int? (position si présente)
    ├── latency_ms: Int
    ├── tokens_used: Int
    ├── cost: Float
    └── prompt_id → Prompt
```

## API — Principaux endpoints

### Auth
| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/auth/register` | Inscription (crée org + user admin) |
| `POST` | `/api/auth/login` | Connexion → access_token + refresh_token |
| `POST` | `/api/auth/refresh` | Rafraîchir le token |
| `GET` | `/api/auth/me` | Profil utilisateur connecté |

### Projects
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/projects` | Liste des projets de l'organisation |
| `POST` | `/api/projects` | Créer un projet |
| `GET` | `/api/projects/{id}` | Détail d'un projet |
| `PATCH` | `/api/projects/{id}` | Modifier un projet |
| `DELETE` | `/api/projects/{id}` | Supprimer un projet |

### Prompts
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/projects/{id}/prompts` | Liste des prompts d'un projet |
| `POST` | `/api/projects/{id}/prompts` | Ajouter des prompts (body: `{texts: [...]}`) |
| `DELETE` | `/api/projects/{id}/prompts/{pid}` | Supprimer un prompt |

### Scan & Résultats
| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/projects/{id}/scan` | Déclencher un scan manuel |
| `GET` | `/api/projects/{id}/results` | Historique des résultats |
| `GET` | `/api/projects/{id}/results/latest` | Dernier scan (SOV + détails) |

## Développement

### Prérequis
- Python 3.13+ (backend)
- Node.js 20+ (frontend)
- PostgreSQL 16
- Redis 7
- Une clé API [OpenRouter](https://openrouter.ai/)

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Le frontend utilise Vite → accessible sur `http://localhost:5173`
Les appels API sont proxyfiés vers `http://localhost:8000` en dev.

## Production

Le déploiement se fait via **Docker Compose** sur **Dokploy** (VM OVH).

```bash
docker compose up -d --build
```

Le reverse proxy est géré par **Traefik** avec certificats Let's Encrypt.

### Variables d'environnement

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `OPENROUTER_API_KEY` | Clé API OpenRouter |
| `JWT_SECRET` | Secret pour les tokens JWT |

## Licence

Propriétaire — Cabesto / Guillaume Deloffre
