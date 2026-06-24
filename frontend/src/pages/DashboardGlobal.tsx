import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import StatsCard from '../components/StatsCard';
import TrendChart from '../components/TrendChart';
import ProjectMatrix from '../components/ProjectMatrix';
import { useProjects } from '../hooks/useApi';

export default function DashboardGlobal() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: projects, loading: loadingProjects } = useProjects();
  const projectsList = projects ?? [];

  /* ── KPI cards ──────────────────────────────────────────── */
  const totalPrompts = useMemo(() => {
    if (!projectsList.length) return '0';
    return `${projectsList.length * 5}+`;
  }, [projectsList]);

  const kpiCards = [
    {
      title: t('global.projects'),
      value: loadingProjects ? '…' : `${projectsList.length}`,
      trend: projectsList.length > 0
        ? `${projectsList.length} ${t('global.thisWeek')}`
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
      value: loadingProjects ? '…' : totalPrompts,
      trend: '+12.3% ' + t('global.vsLastMonth'),
      icon: (
        <svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
      ),
      iconBg: 'bg-violet-500/10',
    },
    {
      title: t('global.sov'),
      value: loadingProjects ? '…' : '—',
      trend: '+5.8% ' + t('global.vsLastMonth'),
      icon: (
        <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
        </svg>
      ),
      iconBg: 'bg-emerald-500/10',
    },
    {
      title: t('global.alerts'),
      value: '0',
      trend: t('global.urgent'),
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
  const matrixProjects = projectsList.map((p) => ({
    name: p.name,
    chatgpt: 0,
    claude: 0,
    perplexity: 0,
    gemini: 0,
    sovAvg: 0,
    onClick: () => navigate(`/project/${p.id}`),
  }));

  /* ── Trend chart (fallback static data) ─────────────────── */
  const chartLabels = ['J-30', 'J-25', 'J-20', 'J-15', 'J-10', 'J-5', "Aujourd'hui"];
  const chartDatasets = [
    { label: 'ChatGPT', data: [28, 32, 30, 35, 38, 40, 42], borderColor: '#3b82f6' },
    { label: 'Claude', data: [22, 25, 24, 28, 33, 35, 38], borderColor: '#8b5cf6' },
    { label: 'Perplexity', data: [8, 10, 9, 11, 13, 14, 15], borderColor: '#10b981' },
    { label: 'Gemini', data: [4, 5, 4, 6, 7, 7, 8], borderColor: '#f59e0b' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('global.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('global.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
            <span>{t('global.period')}</span>
          </div>
          <button className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:from-blue-500 hover:to-violet-500 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-200 active:scale-[.97]" onClick={() => navigate('/project/new')}>
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

      <div className="glass-card rounded-xl p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('global.trendTitle')}</h2>
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500" /> ChatGPT</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-violet-500" /> Claude</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500" /> Perplexity</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500" /> Gemini</span>
          </div>
        </div>
        <TrendChart chartId="trendGlobal" labels={chartLabels} datasets={chartDatasets} />
      </div>

      <div className="glass-card rounded-xl p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('global.matrixTitle')}</h2>
          <button className="btn-ghost inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-all duration-200 text-xs">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            <span>{t('global.export')}</span>
          </button>
        </div>
        {loadingProjects ? (
          <p className="text-sm text-slate-400 py-4 text-center">Chargement des projets...</p>
        ) : matrixProjects.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">Aucun projet. Cliquez sur "+ Déployer un Nouveau Site" pour commencer.</p>
        ) : (
          <ProjectMatrix projects={matrixProjects} />
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
