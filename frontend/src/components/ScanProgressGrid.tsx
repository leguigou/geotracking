import { useState } from 'react';
import { modelDisplay } from '../lib/modelMap';
import type { ScanStatusData } from '../lib/api';

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

/* ── Popover detail ──────────────────────────────────────────────── */

interface CellDetailProps {
  modelId: string;
  data: NonNullable<ScanStatusData['matrix'][number]['models'][string]>;
  promptText: string;
  onClose: () => void;
}

function CellPopover({ modelId, data, promptText, onClose }: CellDetailProps) {
  const model = modelDisplay(modelId);
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      {/* Popover */}
      <div className="absolute z-50 mt-2 w-80 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl p-4 space-y-3 text-sm animate-in fade-in slide-in-from-top-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-lg ${model.iconBg} ${model.iconColor} flex items-center justify-center text-[10px] font-bold`}>
              {model.letter}
            </div>
            <span className="font-semibold text-slate-900 dark:text-white text-xs">{model.label}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 italic line-clamp-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg p-2">
          &ldquo;{promptText}&rdquo;
        </p>

        {data.response_snippet && (
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Réponse</p>
            <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg p-2 font-mono">
              {data.response_snippet}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          {data.rank != null && (
            <div className="bg-slate-100 dark:bg-slate-700/50 rounded-lg p-2">
              <p className="text-[10px] text-slate-400">Rank</p>
              <p className="font-semibold text-slate-900 dark:text-white">#{data.rank}</p>
            </div>
          )}
          {data.latency_ms != null && (
            <div className="bg-slate-100 dark:bg-slate-700/50 rounded-lg p-2">
              <p className="text-[10px] text-slate-400">Latence</p>
              <p className="font-semibold text-slate-900 dark:text-white">{(data.latency_ms / 1000).toFixed(1)}s</p>
            </div>
          )}
        </div>

        {data.competitors.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Concurrents ({data.competitors.length})
            </p>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {data.competitors.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-slate-100 dark:bg-slate-700/50 rounded-lg px-2.5 py-1.5">
                  <span className="truncate text-slate-700 dark:text-slate-300 font-medium">{c.name}</span>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {c.rank != null && <span className="text-[10px] text-slate-400">#{c.rank}</span>}
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
      </div>
    </>
  );
}

/* ── Component ───────────────────────────────────────────────────── */

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
                      {/* Popover for this cell */}
                      {selectedCell?.promptId === row.prompt_id && selectedCell?.modelId === modelId && (
                        <div className="absolute left-1/2 -translate-x-1/2 top-full z-50">
                          <CellPopover
                            modelId={modelId}
                            data={cell}
                            promptText={row.prompt_text}
                            onClose={() => setSelectedCell(null)}
                          />
                        </div>
                      )}
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
    </div>
  );
}
