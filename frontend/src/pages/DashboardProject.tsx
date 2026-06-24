import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import TrendChart from '../components/TrendChart';
import PromptMatrix from '../components/PromptMatrix';
import InspectModal from '../components/InspectModal';
import { useProject, usePrompts } from '../hooks/useApi';
import { api } from '../lib/api';

const LLM_DEFS = [
  { id: 'chatgpt', label: 'ChatGPT', model: 'GPT-4o / GPT-4-turbo', letter: 'C', barColor: 'bg-emerald-500', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-600 dark:text-emerald-400', chartColor: '#3b82f6' },
  { id: 'claude', label: 'Claude', model: 'Claude 3 Opus / Sonnet', letter: 'C', barColor: 'bg-violet-500', iconBg: 'bg-violet-500/10', iconColor: 'text-violet-600 dark:text-violet-400', chartColor: '#8b5cf6' },
  { id: 'perplexity', label: 'Perplexity', model: 'Perplexity Pro', letter: 'P', barColor: 'bg-amber-500', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-600 dark:text-emerald-400', chartColor: '#10b981' },
  { id: 'gemini', label: 'Gemini', model: 'Gemini 1.5 Pro', letter: 'G', barColor: 'bg-red-500', iconBg: 'bg-red-500/10', iconColor: 'text-red-600 dark:text-red-400', chartColor: '#f59e0b' },
];

interface HistoryEntry {
  scan_date: string;
  chatgpt?: number;
  claude?: number;
  perplexity?: number;
  gemini?: number;
  [key: string]: unknown;
}

interface LatestResult {
  scan_date?: string;
  overall?: Record<string, number>;
  prompts?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export default function DashboardProject() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [period, setPeriod] = useState('last30d');
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);

  /* ── API data ───────────────────────────────────────────── */
  const { data: project, loading: loadingProject } = useProject(id);
  const { data: promptsRaw, loading: loadingPrompts } = usePrompts(id);

  const [latest, setLatest] = useState<LatestResult | null>(null);
  const [loadingLatest, setLoadingLatest] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);

  /* Fetch latest results & history directly from api module */
  const fetchLatest = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.getLatestResults(id);
      // getLatestResults returns unknown[] — try to extract first element or use as-is
      if (Array.isArray(res) && res.length > 0) {
        setLatest(res[0] as LatestResult);
      } else if (res && typeof res === 'object' && !Array.isArray(res)) {
        setLatest(res as unknown as LatestResult);
      }
    } catch { /* ignore */ }
    setLoadingLatest(false);
  }, [id]);

  const fetchHistory = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.getResults(id);
      if (Array.isArray(res)) {
        setHistory(res as HistoryEntry[]);
      }
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => { fetchLatest(); }, [fetchLatest]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  /* ── Scan + polling ─────────────────────────────────────── */
  const [scanning, setScanning] = useState(false);

  const handleScan = useCallback(async () => {
    if (!id) return;
    setScanning(true);
    try {
      await api.scanProject(id);
    } catch {
      // scan will fail if backend isn't running
    }
  }, [id]);

  /* Poll every 5s after scan until results arrive */
  useEffect(() => {
    if (!scanning || !id) return;
    const iv = setInterval(async () => {
      try {
        const res = await api.getLatestResults(id);
        if ((Array.isArray(res) && res.length > 0) || (res && typeof res === 'object' && !Array.isArray(res))) {
          if (Array.isArray(res) && res.length > 0) {
            setLatest(res[0] as LatestResult);
          } else {
            setLatest(res as unknown as LatestResult);
          }
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
    llm: string;
    prompt: string;
    responseSnippet: string | null;
    mentioned: boolean;
    position: number | null;
  } | null>(null);

  /* ── SOV cards ──────────────────────────────────────────── */
  const overall = latest?.overall ?? {};

  /* ── Prompt matrix rows ─────────────────────────────────── */
  const promptRows = useMemo(() => {
    if (!promptsRaw || !Array.isArray(promptsRaw)) return [];
    if (latest?.prompts && Array.isArray(latest.prompts)) {
      return latest.prompts.map((pp, i) => ({
        id: i + 1,
        prompt: `"${String(pp.prompt_text ?? '')}"`,
        chatgpt: Boolean(pp.chatgpt ?? false),
        claude: Boolean(pp.claude ?? false),
        perplexity: Boolean(pp.perplexity ?? false),
        gemini: Boolean(pp.gemini ?? false),
        date: latest.scan_date ? new Date(latest.scan_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '',
      }));
    }
    return (promptsRaw as Array<Record<string, unknown>>).map((p) => ({
      id: Number(p.id ?? 0),
      prompt: `"${String(p.text ?? '')}"`,
      chatgpt: (overall.chatgpt ?? 0) > 0,
      claude: (overall.claude ?? 0) > 0,
      perplexity: (overall.perplexity ?? 0) > 0,
      gemini: (overall.gemini ?? 0) > 0,
      date: p.created_at ? new Date(String(p.created_at)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '',
    }));
  }, [promptsRaw, latest, overall]);

  /* ── Trend chart ────────────────────────────────────────── */
  const chartLabels = useMemo(() => {
    if (!history?.length) return ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8'];
    return history.map((h) => {
      const d = new Date(h.scan_date);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });
  }, [history]);

  const chartDatasets = useMemo(() => {
    if (!history?.length) {
      return [
        { label: 'ChatGPT', data: [18, 22, 25, 28, 32, 36, 39, 42], borderColor: '#3b82f6' },
        { label: 'Claude', data: [12, 15, 18, 22, 26, 30, 34, 38], borderColor: '#8b5cf6' },
        { label: 'Perplexity', data: [5, 7, 8, 10, 11, 12, 14, 15], borderColor: '#10b981' },
        { label: 'Gemini', data: [0, 0, 0, 0, 1, 0, 0, 0], borderColor: '#f59e0b', borderDash: [4, 3] },
      ];
    }
    return LLM_DEFS.map((llm) => ({
      label: llm.label,
      data: history.map((h) => Number(h[llm.id] ?? 0)),
      borderColor: llm.chartColor,
      borderDash: history.every((h) => Number(h[llm.id] ?? 0) === 0) ? [4, 3] as number[] : undefined,
    }));
  }, [history]);

  /* ── Themes ──────────────────────────────────────────────── */
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
    // If we have latest.prompts, filter by theme; otherwise filter promptsRaw
    if (latest?.prompts && Array.isArray(latest.prompts)) {
      return promptRows.filter((_, i) => {
        const p = (promptsRaw as Array<Record<string, unknown>>)[i];
        return String(p?.theme ?? '') === selectedTheme;
      });
    }
    return promptRows.filter((_, i) => {
      const p = (promptsRaw as Array<Record<string, unknown>>)[i];
      return String(p?.theme ?? '') === selectedTheme;
    });
  }, [selectedTheme, promptRows, latest, promptsRaw]);

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
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">{t('project.active')}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {Object.keys(overall).length > 0 && (
            <button
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-all duration-200 bg-slate-100 dark:bg-slate-800 text-xs"
              onClick={() => {
                const firstPrompt = promptRows[0];
                const firstLlm = LLM_DEFS[0];
                if (firstPrompt) {
                  setInspectProps({
                    llm: firstLlm.label,
                    prompt: firstPrompt.prompt,
                    responseSnippet: null,
                    mentioned: Boolean(firstPrompt[firstLlm.id as keyof typeof firstPrompt]),
                    position: null,
                  });
                }
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <span>{t('project.inspect')}</span>
            </button>
          )}
          <button
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 active:scale-[.97] text-xs ${
              scanning
                ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:from-blue-500 hover:to-violet-500 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30'
            }`}
            onClick={handleScan}
            disabled={scanning || !id}
          >
            <svg className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            <span>{scanning ? t('project.scanning') || 'Scan en cours…' : t('project.refresh')}</span>
          </button>
        </div>
      </div>

      {/* SOV Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {LLM_DEFS.map((llm) => {
          const sov = overall[llm.id] ?? 0;
          return (
            <div key={llm.id} className="rounded-xl p-5 transition-all duration-200 cursor-default bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 hover:shadow-md">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-8 h-8 rounded-lg ${llm.iconBg} ${llm.iconColor} flex items-center justify-center text-xs font-bold`}>{llm.letter}</div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{llm.label}</p>
                  <p className="text-[10px] text-slate-400">{llm.model}</p>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-900 dark:text-white num">{loadingLatest ? '…' : `${sov}%`}</span>
              </div>
              <div className="mt-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                <div className={`${llm.barColor} h-1.5 rounded-full`} style={{ width: `${Math.max(Number(sov), 2)}%` }} />
              </div>
              <p className="text-xs text-slate-400 mt-2">{Array.isArray(promptsRaw) ? promptsRaw.length : 0} {t('project.promptsTracked')}</p>
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
            {selectedTheme ? `Aucun prompt pour la thématique "${selectedTheme}".` : 'Aucun prompt configuré pour ce projet.'}
          </p>
        ) : (
          <PromptMatrix prompts={filteredPromptRows} />
        )}
      </div>

      {/* Inspect Modal */}
      {inspectProps && (
        <InspectModal
          open={true}
          onClose={() => setInspectProps(null)}
          {...inspectProps}
        />
      )}
    </div>
  );
}
