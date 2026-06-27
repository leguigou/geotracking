import { useEffect, useState } from 'react';
import api, { type CompetitorDetail, type CompetitorPage, type CompetitorSummary } from '../lib/api';
import { modelDisplay } from '../lib/modelMap';

interface Props {
  projectId: string;
  onClose: () => void;
}

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString('fr-FR') : '—';

const shortId = (value?: string | null) => {
  if (!value) return '—';
  return value.length > 7 ? `${value.slice(0, 3)}…${value.slice(-3)}` : value;
};

export default function CompetitorAnalytics({ projectId, onClose }: Props) {
  const [data, setData] = useState<CompetitorPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState<'mentions' | 'recent' | 'rank' | 'name'>('mentions');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, CompetitorDetail>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.getProjectCompetitors(projectId, {
      search: debouncedSearch || undefined,
      sort,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger les concurrents détectés.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedSearch, page, pageSize, projectId, sort]);

  const toggleDetail = async (competitor: CompetitorSummary) => {
    if (expandedKey === competitor.key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(competitor.key);
    if (details[competitor.key]) return;
    setDetailLoading(competitor.key);
    setDetailErrors((current) => ({ ...current, [competitor.key]: '' }));
    try {
      const detail = await api.getCompetitorDetail(projectId, competitor.key);
      setDetails((current) => ({ ...current, [competitor.key]: detail }));
    } catch {
      setDetailErrors((current) => ({ ...current, [competitor.key]: 'Impossible de charger les occurrences de ce concurrent.' }));
    } finally {
      setDetailLoading((current) => current === competitor.key ? null : current);
    }
  };

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 px-3 py-5 sm:px-5">
      <div className="mx-auto w-full max-w-7xl overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl dark:border-slate-700 dark:bg-slate-950">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:px-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Concurrents détectés</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Analyse de tout l’historique : prompts, modèles, dates, rangs, URLs et extraits où chaque concurrent a été identifié.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fermer">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </header>

        <div className="space-y-5 p-4 sm:p-6">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Summary label="Concurrents uniques" value={data?.total_competitors ?? 0} />
            <Summary label="Détections totales" value={data?.total_occurrences ?? 0} />
            <Summary label="Réponses analysées" value={data?.scanned_responses ?? 0} />
            <Summary label="Prompts avec concurrents" value={data?.prompts_with_competitors ?? 0} />
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:flex-row">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input-field min-w-0 flex-1"
              placeholder="Rechercher un concurrent, une URL ou un modèle…"
            />
            <select value={sort} onChange={(event) => { setSort(event.target.value as typeof sort); setPage(1); }} className="input-field sm:w-56">
              <option value="mentions">Plus souvent cité</option>
              <option value="recent">Détection la plus récente</option>
              <option value="rank">Meilleur rang</option>
              <option value="name">Nom A–Z</option>
            </select>
            <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="input-field sm:w-32">
              {[25, 50, 100, 250].map((size) => <option key={size} value={size}>{size} / page</option>)}
            </select>
          </div>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
              Analyse de l’historique des réponses…
            </div>
          ) : !data?.items.length ? (
            <p className="py-16 text-center text-sm text-slate-400">Aucun concurrent ne correspond à cette recherche.</p>
          ) : (
            <div className="space-y-3">
              {data.items.map((competitor, index) => (
                <CompetitorCard
                  key={competitor.key}
                  competitor={competitor}
                  rank={(page - 1) * pageSize + index + 1}
                  expanded={expandedKey === competitor.key}
                  detail={details[competitor.key]}
                  loading={detailLoading === competitor.key}
                  error={detailErrors[competitor.key]}
                  onToggle={() => toggleDetail(competitor)}
                />
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              {data?.total ?? 0} concurrent(s) — page {page}/{totalPages}
            </p>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">Précédente</button>
              <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">Suivante</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompetitorCard({
  competitor,
  rank,
  expanded,
  detail,
  loading,
  error,
  onToggle,
}: {
  competitor: CompetitorSummary;
  rank: number;
  expanded: boolean;
  detail?: CompetitorDetail;
  loading: boolean;
  error?: string;
  onToggle: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <button type="button" onClick={onToggle} className="flex w-full flex-col gap-4 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 lg:flex-row lg:items-center">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500 dark:bg-slate-800">#{rank}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-slate-900 dark:text-white">{competitor.name}</h3>
            {competitor.best_rank != null && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">Meilleur rang #{competitor.best_rank}</span>}
          </div>
          {competitor.urls[0] && <p className="mt-1 truncate text-xs text-blue-600">{competitor.urls[0]}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {competitor.models.map((item) => {
              const model = modelDisplay(item.model);
              return <span key={item.model} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{model.label}: {item.mentions}×</span>;
            })}
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
          <Stat label="Citations" value={String(competitor.mentions)} />
          <Stat label="Part concurrents" value={`${competitor.share_of_competitor_mentions}%`} />
          <Stat label="Prompts" value={String(competitor.prompt_count)} />
          <Stat label="Modèles" value={String(competitor.model_count)} />
        </div>
        <span className="shrink-0 text-xs font-semibold text-blue-600">{expanded ? 'Replier' : 'Voir les détections'}</span>
      </button>

      {expanded && (
        <div className="border-t border-slate-200 p-4 dark:border-slate-700">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Chargement des occurrences…</p>
          ) : error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
          ) : detail ? (
            <CompetitorDetailView detail={detail} />
          ) : (
            <p className="py-8 text-center text-sm text-red-500">Impossible de charger le détail.</p>
          )}
        </div>
      )}
    </article>
  );
}

function CompetitorDetailView({ detail }: { detail: CompetitorDetail }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
        <DetailMetric label="Taux de détection" value={`${detail.detection_rate}%`} />
        <DetailMetric label="Rang moyen" value={detail.average_rank == null ? '—' : `#${detail.average_rank}`} />
        <DetailMetric label="Première détection" value={formatDate(detail.first_detected_at)} />
        <DetailMetric label="Dernière détection" value={formatDate(detail.last_detected_at)} />
      </div>

      <div>
        <h4 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">Statistiques par modèle</h4>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full min-w-[680px] text-xs">
            <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-400 dark:bg-slate-800">
              <tr><th className="px-3 py-2">Modèle</th><th className="px-3 py-2">Citations</th><th className="px-3 py-2">Prompts</th><th className="px-3 py-2">Meilleur rang</th><th className="px-3 py-2">Rang moyen</th><th className="px-3 py-2">Dernière détection</th></tr>
            </thead>
            <tbody>
              {detail.models.map((item) => (
                <tr key={item.model} className="border-t border-slate-100 dark:border-slate-700/60">
                  <td className="px-3 py-2 font-semibold" title={item.model}>{modelDisplay(item.model).label}</td>
                  <td className="px-3 py-2">{item.mentions}</td><td className="px-3 py-2">{item.prompt_count}</td>
                  <td className="px-3 py-2">{item.best_rank == null ? '—' : `#${item.best_rank}`}</td>
                  <td className="px-3 py-2">{item.average_rank == null ? '—' : `#${item.average_rank}`}</td>
                  <td className="px-3 py-2">{formatDate(item.last_detected_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">Toutes les occurrences ({detail.occurrences.length})</h4>
        <div className="space-y-2">
          {detail.occurrences.map((occurrence) => (
            <div key={`${occurrence.result_id}-${occurrence.name}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 dark:text-slate-200">{occurrence.prompt_text}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {modelDisplay(occurrence.model).label} · {formatDate(occurrence.scanned_at)}
                    {occurrence.rank != null ? ` · rang #${occurrence.rank}` : ''}
                    {occurrence.theme ? ` · thème ${occurrence.theme}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right font-mono text-[10px] text-slate-400" title={occurrence.result_id}>
                  scan {shortId(occurrence.result_id)}
                </div>
              </div>
              <blockquote className="mt-3 border-l-2 border-blue-300 pl-3 text-xs leading-5 text-slate-600 dark:border-blue-500 dark:text-slate-300">
                {occurrence.evidence}
              </blockquote>
              {occurrence.url && <a href={occurrence.url} target="_blank" rel="noopener noreferrer" className="mt-2 block truncate text-xs text-blue-600 hover:underline">{occurrence.url}</a>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"><p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{value}</p></div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[9px] uppercase tracking-wide text-slate-400">{label}</p><p className="font-bold text-slate-800 dark:text-slate-200">{value}</p></div>;
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800/50"><p className="text-[9px] uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200">{value}</p></div>;
}
