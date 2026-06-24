# GEOTrack AI — Frontend

Interface d'administration pour le suivi de visibilité IA.

## Stack

- React 20 + TypeScript
- Vite 8 (build)
- Tailwind CSS v4
- react-router-dom, react-i18next
- Chart.js (via react-chartjs-2)
- Axios (appels API)

## Structure

```
src/
├── components/    # Composants réutilisables
│   ├── Layout.tsx
│   ├── Sidebar.tsx
│   ├── TrendChart.tsx
│   ├── MetricCard.tsx / StatsCard.tsx
│   ├── PromptMatrix.tsx / ProjectMatrix.tsx
│   ├── InspectModal.tsx / Badge.tsx
├── hooks/         # Hooks personnalisés
│   ├── useAuth.tsx
│   └── useApi.ts
├── lib/           # Services
│   └── api.ts     # Client Axios + méthodes API
├── pages/         # Pages
│   ├── LoginPage.tsx
│   ├── DashboardGlobal.tsx
│   ├── DashboardProject.tsx
│   ├── CreateProject.tsx
│   └── SettingsPage.tsx
├── i18n/          # Internationalisation (FR/EN)
├── main.tsx       # Entry point + routes
└── index.css      # Styles globaux + custom-variant dark
```

## Commandes

```bash
npm run dev       # Dev server (port 5173)
npm run build     # Build production (→ dist/)
npm run preview   # Preview le build
```

## Thème

Le thème sombre/clair utilise la classe `.dark` sur `<html>`.
En Tailwind v4, le variant `dark:` est redirigé via `@custom-variant dark (&:where(.dark, .dark *))`.
Le choix est persisté dans `localStorage` (clé: `theme`), par défaut: clair.

## Internationalisation

Deux langues : français (défaut) et anglais.
Les traductions sont dans `src/i18n/locales.ts`.
