import { useState } from 'react';
import { modelDisplay } from '../lib/modelMap';
import { api, type ScanStatusData } from '../lib/api';

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString('fr-FR') : '—';

const formatCost = (value?: number | null) =>
  value == null ? '—' : `$${value.toFixed(6)}`;

/* ── Cell status icons ──────────────────────────────────────────── */

function cellIcon(status: string, hasUrl: boolean, hasBrand: boolean) {
  switch (status) {
    case 'pending':
      return <span className="text-slate-400 text-lg" title="En attente">⏳</span>;
    case 'running':
      return <span className="inline-block text-lg animate-spin" title="En cours">🔄</span>;
    case 'completed':
      if (hasUrl || hasBrand) {
        return <span className="text-emerald-500 text-lg" title="Succès">✅</span>;
      }
      return <span className="text-red-500 text-lg" title="Aucune mention">❌</span>;
    case 'failed':
      return <span className="text-amber-500 text-lg" title="Échec">⚠️</span>;
    default:
      return <span className="text-slate-300 text-lg" title="Inconnu">—</span>;
  }
}

interface ScanProgressGridProps {
  matrix: ScanStatusData['matrix'];
  models: string[];
  batchStatus: string;
}

export default function ScanProgressGrid({ matrix, models, batchStatus }: ScanProgressGridProps) {
  const [selectedCell, setSelectedCell] = useState<{
    promptId: string;
    promptText: string;
    modelId: string;
    data: NonNullable<ScanStatusData['matrix'][number]['models'][string]>;
  } | null>(null);
  const [analyzingKey, setAnalyzingKey] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, { text: string; model: string }>>({});
  const [analysisErrors, setAnalysisErrors] = useState<Record<string, string>>({});

  const analyzeResponse = async (key: string, responseText: string, promptText: string) => {
    setAnalyzingKey(key);
    setAnalysisErrors((current) => ({ ...current, [key]: '' }));
    try {
      const result = await api.analyzeResponse(responseText, promptText);
      setAnalyses((current) => ({
        ...current,
        [key]: { text: result.analysis, model: result.model },
      }));
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setAnalysisErrors((current) => ({
        ...current,
        [key]: detail || 'Impossible d’analyser cette réponse.',
      }));
    } finally {
      setAnalyzingKey(null);
    }
  };

  /* Compute progress */
  const totalJobs = matrix.length * models.length;
  const completedJobs = matrix.reduce((acc, row) => {
    return acc + models.reduce((rowAcc, modelId) => {
      const cell = row.models[modelId];
      if (!cell) return rowAcc;
      return rowAcc + (cell.status === 'completed' || cell.status === 'failed' ? 1 : 0);
    }, 0);
  }, 0);

  const isActive = batchStatus === 'queued' || batchStatus === 'running';
  const progressPct = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

  return (
    <div className="glass-card rounded-xl p-5 mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Progression du scan
        </h2>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {completedJobs}/{totalJobs} jobs complétés
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden mb-4">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isActive
              ? 'bg-blue-500'
              : batchStatus === 'completed'
                ? 'bg-emerald-500'
                : batchStatus === 'failed' || batchStatus === 'cancelled'
                  ? 'bg-amber-500'
                  : 'bg-slate-400'
          }`}
          style={{ width: `${Math.max(progressPct, 2)}%` }}
        />
      </div>

      {/* Batch status badge */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Statut</span>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
          batchStatus === 'running' || batchStatus === 'queued'
            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'
            : batchStatus === 'completed'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
              : batchStatus === 'failed'
                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                : batchStatus === 'cancelled'
                  ? 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20'
                  : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
        }`}>
          {batchStatus === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
          {batchStatus === 'queued' && '⏳'}
          {batchStatus}
        </span>
      </div>

      {/* Matrix table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <th className="px-3 py-2.5 text-left min-w-[180px]">Prompt</th>
              <th className="px-3 py-2.5 text-left min-w-[120px]">Thème</th>
              {models.map((modelId) => {
                const info = modelDisplay(modelId);
                return (
                  <th key={modelId} className="px-3 py-2.5 text-center min-w-[60px]" title={info.model}>
                    <div className="flex flex-col items-center gap-0.5">
                      <div className={`w-6 h-6 rounded-lg ${info.iconBg} ${info.iconColor} flex items-center justify-center text-[10px] font-bold`}>
                        {info.letter}
                      </div>
                      <span className="text-[10px] normal-case font-normal">{info.label}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr
                key={row.prompt_id}
                className="border-t border-slate-100 dark:border-slate-700/50 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
              >
                <td className="px-3 py-2.5 max-w-[200px] truncate font-medium text-slate-900 dark:text-white text-xs">
                  &ldquo;{row.prompt_text}&rdquo;
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-400">
                  {row.theme || '—'}
                </td>
                {models.map((modelId) => {
                  const cell = row.models[modelId];
                  if (!cell) {
                    return (
                      <td key={modelId} className="px-3 py-2.5 text-center text-slate-300">
                        —
                      </td>
                    );
                  }
                  const isClickable = cell.status === 'completed' || cell.status === 'failed';
                  return (
                    <td key={modelId} className="px-3 py-2.5 text-center relative">
                      <button
                        onClick={() =>
                          isClickable
                            ? setSelectedCell({
                                promptId: row.prompt_id,
                                promptText: row.prompt_text,
                                modelId,
                                data: cell,
                              })
                            : null
                        }
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                          isClickable
                            ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50'
                            : 'cursor-default'
                        }`}
                        title={isClickable ? 'Cliquer pour voir les détails' : cell.status}
                      >
                        {cellIcon(cell.status, cell.has_url, cell.has_brand)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1"><span className="text-xs">⏳</span> En attente</span>
        <span className="flex items-center gap-1"><span className="text-xs">🔄</span> En cours</span>
        <span className="flex items-center gap-1"><span className="text-xs">✅</span> Succès</span>
        <span className="flex items-center gap-1"><span className="text-xs">❌</span> Aucune mention</span>
        <span className="flex items-center gap-1"><span className="text-xs">⚠️</span> Échec</span>
      </div>

      {/* Detailed results section */}
      {completedJobs > 0 && (
        <div className="mt-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Résultats détaillés
          </h3>
          {matrix.map((row) =>
            models.map((modelId) => {
              const cell = row.models[modelId];
              if (!cell || cell.status === 'pending' || cell.status === 'running') return null;
              const model = modelDisplay(modelId);
              const expandedId = `${row.prompt_id}-${modelId}`;
              const isExpanded = selectedCell?.promptId === row.prompt_id && selectedCell?.modelId === modelId;
              return (
                <div
                  key={expandedId}
                  className={`rounded-xl border transition-all cursor-pointer ${
                    isExpanded
                      ? 'border-blue-300 dark:border-blue-500/50 shadow-md'
                      : 'border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'
                  } bg-white dark:bg-slate-800/50 overflow-hidden`}
                  onClick={() =>
                    setSelectedCell(
                      isExpanded
                        ? null
                        : { promptId: row.prompt_id, promptText: row.prompt_text, modelId, data: cell }
                    )
                  }
                >
                  {/* Card header */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700/30">
                    <div className={`w-7 h-7 rounded-lg ${model.iconBg} ${model.iconColor} flex items-center justify-center text-xs font-bold shrink-0`}>
                      {model.letter}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{model.label}</span>
                        {cellIcon(cell.status, cell.has_url, cell.has_brand)}
                        {cell.rank != null && (
                          <span className="text-[11px] font-medium text-slate-400">#{cell.rank}</span>
                        )}
                        {cell.latency_ms != null && (
                          <span className="text-[11px] text-slate-400">{(cell.latency_ms / 1000).toFixed(1)}s</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        &ldquo;{row.prompt_text}&rdquo;
                      </p>
                    </div>
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>

                  {/* Collapsible content */}
                  {isExpanded && (
                    <div className="p-4 space-y-4">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                          Prompt envoyé
                        </p>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700/50 dark:bg-slate-900/50 dark:text-slate-300">
                          {row.prompt_text}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Metric label="Modèle exact" value={modelId} mono />
                        <Metric label="Date complète" value={formatDate(cell.scanned_at)} />
                        <Metric label="Tokens" value={cell.tokens_used == null ? '—' : String(cell.tokens_used)} />
                        <Metric label="Coût" value={formatCost(cell.cost)} />
                      </div>

                      {/* Response text */}
                      {cell.response_snippet && (
                        <div>
                          <div className="mb-1.5 flex items-center justify-between gap-3">
                            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Réponse complète du modèle
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  navigator.clipboard.writeText(cell.response_snippet || '');
                                }}
                                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                              >
                                Copier
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  analyzeResponse(expandedId, cell.response_snippet || '', row.prompt_text);
                                }}
                                disabled={analyzingKey === expandedId}
                                className="rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:cursor-wait disabled:opacity-60"
                              >
                                {analyzingKey === expandedId
                                  ? 'Analyse...'
                                  : analyses[expandedId]
                                    ? 'Relancer'
                                    : 'Analyser avec l’IA'}
                              </button>
                            </div>
                          </div>
                          <pre className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700/50">
                            {cell.response_snippet}
                          </pre>
                        </div>
                      )}

                      {(analyses[expandedId] || analysisErrors[expandedId]) && (
                        <div
                          onClick={(event) => event.stopPropagation()}
                          className={`rounded-xl border p-4 ${
                            analysisErrors[expandedId]
                              ? 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
                              : 'border-violet-200 bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/10'
                          }`}
                        >
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                              Analyse de l’assistant IA
                            </p>
                            {analyses[expandedId] && (
                              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                {analyses[expandedId].model}
                              </span>
                            )}
                          </div>
                          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                            {analysisErrors[expandedId] || analyses[expandedId]?.text}
                          </div>
                        </div>
                      )}

                      {/* Stats grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {cell.has_url !== undefined && (
                          <div className="bg-slate-50 dark:bg-slate-900/30 rounded-lg p-2.5 border border-slate-200 dark:border-slate-700/30">
                            <p className="text-[10px] text-slate-400">URL présente</p>
                            <p className={`text-sm font-bold ${cell.has_url ? 'text-emerald-600' : 'text-red-500'}`}>
                              {cell.has_url ? 'Oui' : 'Non'}
                            </p>
                          </div>
                        )}
                        {cell.has_brand !== undefined && (
                          <div className="bg-slate-50 dark:bg-slate-900/30 rounded-lg p-2.5 border border-slate-200 dark:border-slate-700/30">
                            <p className="text-[10px] text-slate-400">Marque présente</p>
                            <p className={`text-sm font-bold ${cell.has_brand ? 'text-emerald-600' : 'text-red-500'}`}>
                              {cell.has_brand ? 'Oui' : 'Non'}
                            </p>
                          </div>
                        )}
                        {cell.rank != null && (
                          <div className="bg-slate-50 dark:bg-slate-900/30 rounded-lg p-2.5 border border-slate-200 dark:border-slate-700/30">
                            <p className="text-[10px] text-slate-400">Position</p>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">#{cell.rank}</p>
                          </div>
                        )}
                        {cell.latency_ms != null && (
                          <div className="bg-slate-50 dark:bg-slate-900/30 rounded-lg p-2.5 border border-slate-200 dark:border-slate-700/30">
                            <p className="text-[10px] text-slate-400">Latence</p>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{(cell.latency_ms / 1000).toFixed(1)}s</p>
                          </div>
                        )}
                      </div>

                      {/* Competitors */}
                      {cell.competitors && cell.competitors.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                            Concurrents cités ({cell.competitors.length})
                          </p>
                          <div className="space-y-1">
                            {cell.competitors.map((c, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-900/30 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700/30"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                                    {i + 1}
                                  </span>
                                  <span className="truncate font-medium text-slate-700 dark:text-slate-300">{c.name}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  {c.rank != null && (
                                    <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-medium">
                                      #{c.rank}
                                    </span>
                                  )}
                                  {c.url && (
                                    <a
                                      href={c.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-500 hover:text-blue-600"
                                      title={c.url}
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                      </svg>
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {cell.error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg p-3">
                          <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">Erreur</p>
                          <p className="text-xs text-red-700 dark:text-red-300">{cell.error}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 bg-slate-50 dark:bg-slate-900/30 rounded-lg p-2.5 border border-slate-200 dark:border-slate-700/30">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className={`truncate text-sm font-bold text-slate-900 dark:text-white ${mono ? 'font-mono text-xs' : ''}`} title={value}>
        {value}
      </p>
    </div>
  );
}
