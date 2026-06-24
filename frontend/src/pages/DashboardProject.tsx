import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import TrendChart from '../components/TrendChart';
import PromptMatrix from '../components/PromptMatrix';
import InspectModal from '../components/InspectModal';
import { useProject, usePrompts } from '../hooks/useApi';
import { api, type ScanResultData } from '../lib/api';
import { getLlmInfo, computePerModelSov, buildPromptMatrix, buildTrendSeries, getUniqueModels, type ModelSov, type PromptMatrixRow } from '../lib/dataTransform';
import ManagePrompts from '../components/ManagePrompts';
import ScanHistory from '../components/ScanHistory';

export default function DashboardProject() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  const [period, setPeriod] = useState('last30d');
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);

  /* ── Actions projet ────────────────────────────────────────── */
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPromptsManager, setShowPromptsManager] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [showScanHistory, setShowScanHistory] = useState(false);
  const [scanModel, setScanModel] = useState('');

  /* ── API data ───────────────────────────────────────────── */
  const { data: project, loading: loadingProject } = useProject(id);
  const { data: promptsRaw, loading: loadingPrompts } = usePrompts(id);

  const [latestResults, setLatestResults] = useState<ScanResultData[] | null>(null);
  const [loadingLatest, setLoadingLatest] = useState(true);
  const [historyResults, setHistoryResults] = useState<ScanResultData[] | null>(null);

  const fetchLatest = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.getLatestResults(id) as { results?: ScanResultData[]; scanned_at?: string; sov?: Record<string, unknown> };
      if (res && Array.isArray(res.results) && res.results.length > 0) {
        setLatestResults(res.results);
      } else {
        setLatestResults(null);
      }
    } catch { /* ignore */ }
    setLoadingLatest(false);
  }, [id]);

  const fetchHistory = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.getResults(id) as ScanResultData[];
      if (Array.isArray(res)) {
        setHistoryResults(res);
      }
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => { fetchLatest(); }, [fetchLatest]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const [scanning, setScanning] = useState(false);

  /* Poll every 5s after scan until results arrive */
  useEffect(() => {
    if (!scanning || !id) return;
    const iv = setInterval(async () => {
      try {
        const res = await api.getLatestResults(id) as { results?: ScanResultData[] };
        if (res && Array.isArray(res.results) && res.results.length > 0) {
          setLatestResults(res.results);
          setScanning(false);
          fetchHistory();
        }
      } catch {
        // still waiting
      }
    }, 5000);
    return () => clearInterval(iv);
  }, [scanning, id, fetchHistory]);

  /* ── Inspect modal ──────────────────────────────────────── */
  const [inspectProps, setInspectProps] = useState<{
    open: boolean;
    llm: string;
    prompt: string;
    responseSnippet: string | null;
    mentioned: boolean;
    position: number | null;
    hasChanges: boolean;
    note: string | null;
    resultId: string;
  } | null>(null);

  /* ── Computed data ──────────────────────────────────────── */
  const sovList: ModelSov[] = useMemo(
    () => latestResults ? computePerModelSov(latestResults) : [],
    [latestResults],
  );

  const promptRows: PromptMatrixRow[] = useMemo(
    () => {
      if (!promptsRaw || !Array.isArray(promptsRaw) || !latestResults) return [];
      return buildPromptMatrix(latestResults, promptsRaw as Array<{ id: string; text: string; theme?: string; created_at?: string }>);
    },
    [latestResults, promptsRaw],
  );

  const activeModels = useMemo(
    () => latestResults ? getUniqueModels(latestResults) : (project?.enabled_models as string[] ?? []),
    [latestResults, project],
  );

  const themes = useMemo(() => {
    if (!Array.isArray(promptsRaw)) return [];
    const t = new Set<string>();
    for (const p of promptsRaw) {
      const th = String((p as Record<string, unknown>).theme ?? '');
      if (th) t.add(th);
    }
    return Array.from(t).sort();
  }, [promptsRaw]);

  const filteredPromptRows = useMemo(() => {
    if (!selectedTheme) return promptRows;
    return promptRows.filter((r) => r.theme === selectedTheme);
  }, [selectedTheme, promptRows]);

  const trendPoints = useMemo(
    () => historyResults ? buildTrendSeries(historyResults) : [],
    [historyResults],
  );

  const chartLabels = useMemo(
    () => trendPoints.map((p) => {
      const d = new Date(p.date);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    }),
    [trendPoints],
  );

  const chartDatasets = useMemo(() => {
    if (trendPoints.length === 0) {
      // Données mock
      return [
        { label: 'ChatGPT', data: [18, 22, 25, 28, 32, 36, 39, 42], borderColor: '#10b981' },
        { label: 'Claude', data: [12, 15, 18, 22, 26, 30, 34, 38], borderColor: '#8b5cf6' },
        { label: 'Perplexity', data: [5, 7, 8, 10, 11, 12, 14, 15], borderColor: '#f97316' },
        { label: 'Gemini', data: [0, 0, 0, 0, 1, 0, 0, 0], borderColor: '#f59e0b', borderDash: [4, 3] as number[] },
      ];
    }
    // Collecter tous les modèles présents dans les points
    const allModels = new Set<string>();
    for (const pt of trendPoints) {
      for (const model of Object.keys(pt.values)) allModels.add(model);
    }
    return Array.from(allModels).map((model) => {
      const info = getLlmInfo(model);
      return {
        label: info.label,
        data: trendPoints.map((pt) => pt.values[model] ?? 0),
        borderColor: info.chartColor,
        borderDash: trendPoints.every((pt) => (pt.values[model] ?? 0) === 0) ? [4, 3] as number[] : undefined,
      };
    });
  }, [trendPoints]);

  /* ── Loading state ──────────────────────────────────────── */
  if (loadingProject && !project) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-500 dark:text-slate-400">Chargement du projet...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-2">
        <span className="cursor-pointer hover:text-slate-700 dark:hover:text-slate-300">{t('nav.dashboard')}</span>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
        <span className="text-slate-900 dark:text-white font-medium">{project?.name ?? 'Projet'}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{project?.name ?? 'Projet'}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span>{t('project.url')}</span> : <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{project?.target_url ?? '—'}</span>
              <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                project?.is_active !== false
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
              }`}>
                {project?.is_active !== false ? t('project.active') : 'En pause'}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Action menu */}
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-all"
              title="Actions"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
              </svg>
            </button>
            {showActions && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-1">
                  <button
                    onClick={() => {
                      setEditName(project?.name || '');
                      setEditUrl(project?.target_url || '');
                      setEditing(true);
                      setShowActions(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors text-left"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                    Modifier
                  </button>
                  <button
                    onClick={async () => {
                      if (!id) return;
                      setTogglingActive(true);
                      setShowActions(false);
                      try {
                        await api.updateProject(id, { is_active: project?.is_active === false ? true : false });
                        window.location.reload();
                      } catch (err) {
                        alert(`Erreur: ${err instanceof Error ? err.message : 'Échec'}`);
                      } finally {
                        setTogglingActive(false);
                      }
                    }}
                    disabled={togglingActive}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors text-left"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      {project?.is_active !== false ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9v6m-4.5 0V9M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      )}
                    </svg>
                    {project?.is_active !== false ? 'Mettre en pause' : 'Réactiver'}
                  </button>
                  <button
                    onClick={() => { setShowPromptsManager(true); setShowActions(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors text-left"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
                    Gérer les prompts
                  </button>
                  <button
                    onClick={() => { setShowScanHistory(true); setShowActions(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors text-left"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Historique des scans
                  </button>
                  <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                  <button
                    onClick={() => { setConfirmDelete(true); setShowActions(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                    Supprimer
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {project && (
              <button
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-all duration-200 bg-slate-100 dark:bg-slate-800 text-xs"
                onClick={() => window.location.href = `/project/${id}/responses`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>
                <span>Réponses</span>
              </button>
            )}
          {latestResults && latestResults.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-all duration-200 bg-slate-100 dark:bg-slate-800 text-xs"
                onClick={async () => {
                  if (!id || !latestResults?.length) return;
                  try {
                    const first = latestResults[0];
                    const detail = await api.getResultDetail(id, first.id);
                    setInspectProps({
                      open: true,
                      llm: detail.model,
                      prompt: detail.prompt_text,
                      responseSnippet: detail.response_text,
                      mentioned: detail.has_brand,
                      position: detail.rank,
                      hasChanges: detail.has_changes,
                      note: detail.note,
                      resultId: detail.id,
                    });
                  } catch { /* ignore */ }
                }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span>{t('project.inspect')}</span>
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            {/* Sélecteur de modèle pour le scan */}
            <select
              className="input-field text-xs py-2 w-auto"
              value={scanModel}
              onChange={(e) => setScanModel(e.target.value)}
              disabled={scanning}
            >
              <option value="">Tous les LLMs</option>
              {activeModels.map((model) => (
                <option key={model} value={model}>{getLlmInfo(model).label}</option>
              ))}
            </select>

            {/* Bouton Scan / Annuler */}
            <button
              className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 active:scale-[.97] text-xs ${
                scanning
                  ? 'bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-500/20'
                  : 'bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:from-blue-500 hover:to-violet-500 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30'
              }`}
              onClick={async () => {
                if (scanning && id) {
                  try {
                    await api.cancelScan(id);
                  } catch { /* ignore */ }
                  setScanning(false);
                  return;
                }
                if (!id) return;
                setScanning(true);
                try {
                  await api.scanProject(id, scanModel || undefined);
                } catch {
                  setScanning(false);
                }
              }}
              disabled={!id}
            >
              <svg className={`w-3.5 h-3.5 ${scanning ? '' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                {scanning ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                )}
              </svg>
              <span>{scanning ? 'Annuler' : t('project.refresh')}</span>
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* SOV Cards — une carte par modèle actif */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {sovList.length === 0 ? (
          // Fallback : afficher les modèles du projet avec SOV à 0
          activeModels.length > 0 ? activeModels.map((model) => {
            const info = getLlmInfo(model);
            return (
              <div key={model} className="rounded-xl p-5 transition-all duration-200 cursor-default bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 hover:shadow-md">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-lg ${info.iconBg} ${info.iconColor} flex items-center justify-center text-xs font-bold`}>{info.letter}</div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{info.label}</p>
                    <p className="text-[10px] text-slate-400">{model.split('/').pop()}</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white num">—</span>
                </div>
                <div className="mt-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                  <div className={`${info.barColor} h-1.5 rounded-full`} style={{ width: '0%' }} />
                </div>
                <p className="text-xs text-slate-400 mt-2">0 prompt scanné</p>
              </div>
            );
          }) : (
            <div className="col-span-full text-center py-8 text-sm text-slate-500">Aucun modèle configuré. Lance un scan pour commencer.</div>
          )
        ) : sovList.map((s) => {
          const info = getLlmInfo(s.model);
          return (
            <div key={s.model} className="rounded-xl p-5 transition-all duration-200 cursor-default bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 hover:shadow-md">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-8 h-8 rounded-lg ${info.iconBg} ${info.iconColor} flex items-center justify-center text-xs font-bold`}>{info.letter}</div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{info.label}</p>
                  <p className="text-[10px] text-slate-400">{s.model.split('/').pop()}</p>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-900 dark:text-white num">{loadingLatest ? '…' : `${s.sovUrl}%`}</span>
              </div>
              <div className="mt-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                <div className={`${info.barColor} h-1.5 rounded-full transition-all duration-500`} style={{ width: `${Math.max(s.sovUrl, 2)}%` }} />
              </div>
              <p className="text-xs text-slate-400 mt-2">{s.total} prompt{s.total > 1 ? 's' : ''} scanné{s.total > 1 ? 's' : ''}</p>
            </div>
          );
        })}
      </div>

      {/* Trend Chart */}
      <div className="glass-card rounded-xl p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('project.trendTitle', { name: project?.name ?? '' })}</h2>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="text-xs bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-600 dark:text-slate-400 outline-none">
            <option value="last7d">{t('project.last7d')}</option>
            <option value="last30d">{t('project.last30d')}</option>
            <option value="last90d">{t('project.last90d')}</option>
          </select>
        </div>
        <TrendChart chartId="trendProject" labels={chartLabels} datasets={chartDatasets} />
      </div>

      {/* Prompt Matrix */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('project.promptMatrix')}</h2>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> {t('project.mentioned')}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> {t('project.absent')}</span>
          </div>
        </div>

        {/* Theme filter tabs */}
        {themes.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setSelectedTheme(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                !selectedTheme
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Tous les thèmes
            </button>
            {themes.map((th) => (
              <button
                key={th}
                onClick={() => setSelectedTheme(th)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedTheme === th
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {th}
              </button>
            ))}
          </div>
        )}

        {loadingPrompts ? (
          <p className="text-sm text-slate-400 py-4">Chargement des prompts...</p>
        ) : filteredPromptRows.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">
            {selectedTheme ? `Aucun prompt pour la thématique "${selectedTheme}".` : 'Aucun résultat disponible. Lance un scan pour voir la matrice.'}
          </p>
        ) : (
          <PromptMatrix prompts={filteredPromptRows} />
        )}
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-5">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Modifier le projet</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Nom du projet</label>
              <input type="text" className="input-field w-full" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">URL du site</label>
              <input type="text" className="input-field w-full" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditing(false)} className="btn-secondary">Annuler</button>
              <button
                onClick={async () => {
                  if (!id) return;
                  setSavingEdit(true);
                  try {
                    await api.updateProject(id, { name: editName, target_url: editUrl });
                    setEditing(false);
                    window.location.reload();
                  } catch (err) {
                    alert(`Erreur: ${err instanceof Error ? err.message : 'Échec'}`);
                  } finally {
                    setSavingEdit(false);
                  }
                }}
                disabled={savingEdit || !editName || !editUrl}
                className="btn-primary"
              >
                {savingEdit ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Supprimer le projet</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Cette action est irréversible.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary" disabled={deleting}>Annuler</button>
              <button
                onClick={async () => {
                  if (!id) return;
                  setDeleting(true);
                  try {
                    await api.deleteProject(id);
                    window.location.href = '/';
                  } catch (err) {
                    alert(`Erreur: ${err instanceof Error ? err.message : 'Échec'}`);
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-500 transition-all"
              >
                {deleting ? 'Suppression...' : 'Oui, supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPromptsManager && id && (
        <ManagePrompts
          projectId={id}
          prompts={Array.isArray(promptsRaw) ? promptsRaw : []}
          onClose={() => setShowPromptsManager(false)}
          onRefresh={() => window.location.reload()}
        />
      )}

      {showScanHistory && id && (
        <ScanHistory projectId={id} onClose={() => setShowScanHistory(false)} />
      )}

      {/* Inspect Modal */}
      {inspectProps && (
        <InspectModal
          onClose={() => setInspectProps(null)}
          projectId={id}
          {...inspectProps}
        />
      )}
    </div>
  );
}
