import { useEffect, useMemo, useState } from 'react';
import { api, type ScanResultLogEntry } from '../lib/api';
import { modelDisplay } from '../lib/modelMap';
import Badge from './Badge';

interface Props {
  projectId: string;
  onClose: () => void;
}

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString('fr-FR') : '—';

const formatCost = (value?: number | null) =>
  value == null ? '—' : `$${value.toFixed(6)}`;

const statusVariant = (entry: ScanResultLogEntry): 'emerald' | 'red' | 'amber' => {
  if (entry.error) return 'amber';
  if (entry.has_url || entry.has_brand) return 'emerald';
  return 'red';
};

const statusLabel = (entry: ScanResultLogEntry) => {
  if (entry.error) return 'Erreur';
  if (entry.has_url || entry.has_brand) return 'Mention trouvée';
  return 'Marque absente';
};

export default function ScanHistory({ projectId, onClose }: Props) {
  const [results, setResults] = useState<ScanResultLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.getResults(projectId, 500);
        if (cancelled) return;
        setResults(
          [...list].sort((a, b) =>
            String(b.scanned_at ?? '').localeCompare(String(a.scanned_at ?? '')),
          ),
        );
      } catch {
        // ignore
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const summary = useMemo(() => {
    const total = results.length;
    const mentions = results.filter((item) => item.has_url || item.has_brand).length;
    const errors = results.filter((item) => item.error).length;
    const batches = new Set(results.map((item) => item.batch_id).filter(Boolean)).size;
    return { total, mentions, errors, batches };
  }, [results]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-3 py-6 sm:px-4 sm:py-12">
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 dark:border-slate-700 sm:px-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Logs complets des scans</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Déplie une ligne pour voir le prompt, la réponse complète, les métriques, l'erreur et les concurrents détectés.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fermer">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:px-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Réponses</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{summary.total}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-500/10">
              <p className="text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-300">Mentions</p>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-200">{summary.mentions}/{summary.total}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-500/10">
              <p className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-300">Erreurs</p>
              <p className="text-lg font-bold text-amber-700 dark:text-amber-200">{summary.errors}</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-500/10">
              <p className="text-[10px] uppercase tracking-wide text-blue-600 dark:text-blue-300">Batchs</p>
              <p className="text-lg font-bold text-blue-700 dark:text-blue-200">{summary.batches}</p>
            </div>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Chargement...</p>
          ) : results.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Aucun scan effectué pour ce projet.</p>
          ) : (
            <div className="space-y-3">
              {results.map((entry) => {
                const model = modelDisplay(entry.model);
                const expanded = expandedId === entry.id;
                return (
                  <div key={entry.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : entry.id)}
                      className="flex w-full flex-col gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 sm:flex-row sm:items-center"
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${model.iconBg} ${model.iconColor} text-xs font-bold`}>
                        {model.letter}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">{model.label}</span>
                          <Badge variant={statusVariant(entry)}>{statusLabel(entry)}</Badge>
                          {entry.rank != null && <span className="text-xs text-slate-500">rang #{entry.rank}</span>}
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                          {entry.prompt_text || 'Prompt inconnu'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-xs text-slate-400 sm:flex-col sm:items-end">
                        <span>{formatDate(entry.scanned_at)}</span>
                        <span>{expanded ? 'Replier' : 'Déplier'}</span>
                      </div>
                    </button>

                    {expanded && (
                      <div className="space-y-4 border-t border-slate-200 p-4 dark:border-slate-700">
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                          <Info label="Scan ID" value={entry.id} mono />
                          <Info label="Prompt ID" value={entry.prompt_id} mono />
                          <Info label="Batch" value={entry.batch_id || '—'} mono />
                          <Info label="Modèle exact" value={entry.model} mono />
                          <Info label="Latence" value={entry.latency_ms == null ? '—' : `${entry.latency_ms} ms`} />
                          <Info label="Tokens" value={entry.tokens_used == null ? '—' : String(entry.tokens_used)} />
                          <Info label="Coût" value={formatCost(entry.cost)} />
                          <Info label="URL citée" value={entry.has_url ? 'Oui' : 'Non'} />
                          <Info label="Marque citée" value={entry.has_brand ? 'Oui' : 'Non'} />
                          <Info label="Date complète" value={formatDate(entry.scanned_at)} />
                        </div>

                        <section>
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Prompt envoyé</p>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                            {entry.prompt_text || '—'}
                          </div>
                        </section>

                        {entry.error && (
                          <section className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Erreur</p>
                            <p className="whitespace-pre-wrap text-sm text-amber-800 dark:text-amber-100">{entry.error}</p>
                          </section>
                        )}

                        <section>
                          <div className="mb-1.5 flex items-center justify-between gap-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Réponse complète du modèle</p>
                            {entry.response_text && (
                              <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(entry.response_text || '')}
                                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                              >
                                Copier
                              </button>
                            )}
                          </div>
                          {entry.response_text ? (
                            <pre className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
                              {entry.response_text}
                            </pre>
                          ) : (
                            <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm italic text-slate-400 dark:border-slate-700 dark:bg-slate-900/40">
                              Aucune réponse stockée pour cette entrée.
                            </p>
                          )}
                        </section>

                        <section>
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Concurrents détectés ({entry.competitors?.length ?? 0})
                          </p>
                          {entry.competitors?.length ? (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {entry.competitors.map((competitor, index) => (
                                <div key={`${competitor.name}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/40">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{competitor.name}</span>
                                    {competitor.rank != null && <span className="text-xs text-slate-500">#{competitor.rank}</span>}
                                  </div>
                                  {competitor.url && (
                                    <a href={competitor.url} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-xs text-blue-600 hover:underline dark:text-blue-400">
                                      {competitor.url}
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-400">Aucun concurrent détecté dans cette réponse.</p>
                          )}
                        </section>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 px-4 py-4 dark:border-slate-700 sm:px-6">
          <button onClick={onClose} className="btn-primary">Fermer</button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 truncate text-xs font-semibold text-slate-800 dark:text-slate-200 ${mono ? 'font-mono' : ''}`} title={value}>
        {value}
      </p>
    </div>
  );
}
