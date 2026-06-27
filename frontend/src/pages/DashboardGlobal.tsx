import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import StatsCard from '../components/StatsCard';
import TrendChart from '../components/TrendChart';
import ProjectMatrix from '../components/ProjectMatrix';
import HelpTooltip from '../components/HelpTooltip';
import { api, type DashboardOverview } from '../lib/api';
import { modelDisplay } from '../lib/modelMap';

const MODEL_COLORS = ['#2563eb', '#7c3aed', '#059669', '#ea580c', '#db2777', '#0891b2', '#ca8a04', '#475569'];
const MODEL_DASHES: Array<number[] | undefined> = [undefined, [7, 4], [2, 3], [10, 4, 2, 4]];

export default function DashboardGlobal() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [selectedTrendModel, setSelectedTrendModel] = useState('all');

  useEffect(() => {
    let cancelled = false;
    api.getDashboardOverview()
      .then((data) => { if (!cancelled) setOverview(data); })
      .finally(() => { if (!cancelled) setLoadingProjects(false); });
    return () => { cancelled = true; };
  }, []);

  const projectsList = useMemo(() => overview?.projects ?? [], [overview?.projects]);
  const totals = overview?.totals ?? { projects: 0, active_projects: 0, prompts: 0, average_sov: 0, failed_jobs: 0 };
  const alerts = overview?.alerts ?? [];
  const topCompetitors = overview?.top_competitors ?? [];
  const alertStyles = {
    critical: 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200',
    warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
    info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200',
  } as const;

  const kpiCards = [
    {
      title: t('global.projects'),
      value: loadingProjects ? '…' : `${totals.projects}`,
      trend: projectsList.length > 0
        ? `${totals.active_projects} actifs`
        : loadingProjects ? '' : 'Aucun projet',
      icon: (
        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" />
        </svg>
      ),
      iconBg: 'bg-blue-500/10',
    },
    {
      title: t('global.prompts'),
      value: loadingProjects ? '…' : String(totals.prompts),
      trend: 'prompts configurés',
      icon: (
        <svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
      ),
      iconBg: 'bg-violet-500/10',
    },
    {
      title: t('global.sov'),
      value: loadingProjects ? '…' : `${totals.average_sov}%`,
      trend: 'moyenne des derniers scans',
      icon: (
        <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
        </svg>
      ),
      iconBg: 'bg-emerald-500/10',
    },
    {
      title: t('global.alerts'),
      value: String(alerts.length || totals.failed_jobs),
      trend: alerts.length ? 'actions prioritaires' : totals.failed_jobs ? t('global.urgent') : 'Aucune erreur',
      trendColor: 'text-slate-500 dark:text-slate-400',
      icon: (
        <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      ),
      iconBg: 'bg-slate-500/10',
    },
  ];

  /* ── Matrix rows from real projects ─────────────────────── */
  const modelIds = useMemo(() => {
    const usage = new Map<string, number>();
    for (const project of projectsList) {
      const projectModels = new Set([
        ...(project.enabled_models ?? []),
        ...Object.keys(project.provider_stats ?? {}),
      ]);
      for (const modelId of projectModels) usage.set(modelId, (usage.get(modelId) ?? 0) + 1);
    }
    for (const entry of overview?.trend ?? []) {
      for (const modelId of Object.keys(entry.provider_stats ?? {})) {
        if (!usage.has(modelId)) usage.set(modelId, 0);
      }
    }
    return Array.from(usage)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([modelId]) => modelId);
  }, [overview?.trend, projectsList]);

  const matrixProjects = projectsList.map((project) => ({
    id: project.id,
    name: project.name,
    stats: project.provider_stats ?? {},
    sovAvg: project.sov_avg ?? null,
    onClick: () => navigate(`/project/${project.id}`),
  }));

  const globalHistory = overview?.trend ?? [];
  const chartLabels = globalHistory.map((entry) => new Date(entry.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
  const visibleTrendModels = selectedTrendModel === 'all'
    ? modelIds.slice(0, 8)
    : modelIds.filter((modelId) => modelId === selectedTrendModel);
  const chartDatasets = visibleTrendModels.map((modelId) => {
    const modelIndex = modelIds.indexOf(modelId);
    return {
    label: modelDisplay(modelId).label,
    data: globalHistory.map((entry) => {
      const stats = entry.provider_stats?.[modelId];
      return stats ? stats.sov : null;
    }),
    pointMeta: globalHistory.map((entry) => entry.provider_stats?.[modelId] ?? null),
    borderColor: MODEL_COLORS[modelIndex % MODEL_COLORS.length],
    borderDash: MODEL_DASHES[modelIndex % MODEL_DASHES.length],
  }});

  const exportCsv = () => {
    const rows = [
      ['Projet', ...modelIds, 'SOV moyenne'],
      ...projectsList.map((project) => {
        const values = modelIds.map((modelId) => {
          const stats = project.provider_stats?.[modelId];
          return stats ? `${stats.sov}% (${stats.mentions}/${stats.total})` : 'N/A';
        });
        const available = Object.values(project.overall);
        const average = available.length ? Math.round(available.reduce((sum, value) => sum + value, 0) / available.length) : 0;
        return [project.name, ...values, average];
      }),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `geotrack-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('global.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('global.subtitle')}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
            <span>{t('global.period')}</span>
          </div>
          <button className="btn-primary inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:from-blue-500 hover:to-violet-500 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-200 active:scale-[.97] sm:w-auto" onClick={() => navigate('/project/new')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            <span>{t('global.deploy')}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {kpiCards.map((kpi, i) => (
          <StatsCard key={i} {...kpi} />
        ))}
      </div>

      <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
        <div className="flex items-start gap-3">
          <HelpTooltip title="Comment lire les scores ?">
            3/6 signifie que la marque a été citée dans 3 réponses sur 6 réponses analysées. 0/6 veut dire que des scans ont bien eu lieu, mais que la marque n'est jamais sortie. N/A veut dire qu'il n'y a pas encore de donnée pour ce modèle.
          </HelpTooltip>
          <p>
            Lecture rapide : <strong>3/6</strong> = 3 réponses citent la marque sur 6 réponses analysées. <strong>0/6</strong> est une vraie donnée, pas une absence de scan.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-8">
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Alertes prioritaires</h2>
                <HelpTooltip title="Alertes prioritaires">
                  Ce bloc met en avant les problèmes à traiter d'abord : aucun scan, erreurs OpenRouter, ou visibilité très faible sur le dernier scan.
                </HelpTooltip>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Les points à traiter en premier sur les derniers scans.</p>
            </div>
            <span className="text-xs text-slate-400">{alerts.length} alerte{alerts.length > 1 ? 's' : ''}</span>
          </div>
          {alerts.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              Rien d'urgent : les derniers scans ne remontent pas d'anomalie forte.
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 5).map((alert, index) => (
                <button
                  key={`${alert.project_id}-${index}`}
                  onClick={() => navigate(`/project/${alert.project_id}`)}
                  className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition hover:shadow-sm ${alertStyles[alert.severity]}`}
                >
                  <span className="block text-xs font-semibold uppercase tracking-wide opacity-70">{alert.project_name}</span>
                  <span>{alert.message}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Concurrents visibles</h2>
                <HelpTooltip title="Concurrents visibles">
                  Ce sont les marques ou sites que les IA citent à la place ou à côté de ta marque dans les dernières réponses analysées.
                </HelpTooltip>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Les marques qui reviennent le plus souvent dans les réponses IA.</p>
            </div>
          </div>
          {topCompetitors.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">Aucun concurrent detecte pour le moment.</p>
          ) : (
            <div className="space-y-2">
              {topCompetitors.slice(0, 5).map((competitor, index) => (
                <div key={`${competitor.name}-${index}`} className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700/50 px-4 py-3">
                  <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{competitor.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {competitor.mentions} mention{competitor.mentions > 1 ? 's' : ''}
                      {competitor.average_rank ? ` · rang moyen #${competitor.average_rank}` : ''}
                      {competitor.models.length ? ` · ${competitor.models.join(', ')}` : ''}
                    </p>
                  </div>
                  {competitor.url && (
                    <a href={competitor.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                      site
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="glass-card rounded-xl p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('global.trendTitle')}</h2>
            <HelpTooltip title="Évolution de la visibilité">
              Chaque courbe montre la part de réponses où ta marque est citée. Une absence de point signifie qu'il n'y avait pas de donnée ; un point à 0% signifie que des réponses ont été analysées, mais sans mention.
            </HelpTooltip>
          </div>
          <select
            value={selectedTrendModel}
            onChange={(event) => setSelectedTrendModel(event.target.value)}
            className="input-field max-w-72 text-xs py-1.5"
          >
            <option value="all">Vue globale — {Math.min(modelIds.length, 8)} modèles principaux</option>
            {modelIds.map((modelId) => (
              <option key={modelId} value={modelId}>{modelDisplay(modelId).label} — {modelId}</option>
            ))}
          </select>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {visibleTrendModels.map((modelId) => {
            const index = modelIds.indexOf(modelId);
            return (
              <span key={modelId} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300" title={modelId}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: MODEL_COLORS[index % MODEL_COLORS.length] }} />
                <span className="truncate">{modelDisplay(modelId).label}</span>
              </span>
            );
          })}
          {selectedTrendModel === 'all' && modelIds.length > 8 && (
            <span className="px-2 py-1 text-xs text-slate-400">+{modelIds.length - 8} autres dans le sélecteur</span>
          )}
        </div>
        <TrendChart chartId="trendGlobal" labels={chartLabels} datasets={chartDatasets} />
      </div>

      <div className="glass-card rounded-xl p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('global.matrixTitle')}</h2>
            <HelpTooltip title="Matrice projets × IA">
              Cette table compare les projets et les modèles IA. Le pourcentage donne la visibilité, et le ratio sous le badge indique combien de réponses ont réellement cité la marque.
            </HelpTooltip>
          </div>
          <button onClick={exportCsv} className="btn-ghost inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-all duration-200 text-xs">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            <span>{t('global.export')}</span>
          </button>
        </div>
        {loadingProjects ? (
          <p className="text-sm text-slate-400 py-4 text-center">Chargement des projets...</p>
        ) : matrixProjects.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">Aucun projet. Cliquez sur "+ Déployer un Nouveau Site" pour commencer.</p>
        ) : (
          <ProjectMatrix projects={matrixProjects} models={modelIds} />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            icon: <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>,
            iconBg: 'bg-blue-500/10',
            title: t('global.addProject'),
            desc: t('global.addProjectDesc'),
            onClick: () => navigate('/project/new'),
          },
          {
            icon: <svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
            iconBg: 'bg-violet-500/10',
            title: t('global.report'),
            desc: t('global.reportDesc'),
          },
          {
            icon: <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
            iconBg: 'bg-emerald-500/10',
            title: t('global.optimize'),
            desc: t('global.optimizeDesc'),
          },
        ].map((action, i) => (
          <div
            key={i}
            className="glass-card rounded-xl p-5 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={action.onClick}
          >
            <div className={`w-10 h-10 rounded-lg ${action.iconBg} flex items-center justify-center shrink-0`}>
              {action.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{action.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{action.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
