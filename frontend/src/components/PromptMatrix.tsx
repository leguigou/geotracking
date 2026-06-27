import { useState } from 'react';
import Badge from './Badge';
import api, { type PromptStatsData } from '../lib/api';
import { modelDisplay } from '../lib/modelMap';

interface PromptRow {
  id: number | string;
  prompt: string;
  date: string;
  theme?: string;
  createdAt?: string;
  [key: string]: string | number | undefined;
}

type MentionStatus = 'mentioned' | 'absent' | 'pending' | 'error' | 'not_scanned';

function statusBadge(status: MentionStatus) {
  if (status === 'mentioned') return <Badge variant="emerald">✓ Mentionné</Badge>;
  if (status === 'absent') return <Badge variant="red">Absent</Badge>;
  if (status === 'pending') return <Badge variant="blue">En attente</Badge>;
  if (status === 'error') return <Badge variant="amber">Erreur</Badge>;
  return <Badge variant="slate">Non scanné</Badge>;
}

const shortId = (value: string | number) => {
  const id = String(value);
  return id.length > 7 ? `${id.slice(0, 3)}…${id.slice(-3)}` : id;
};

const formatCreatedAt = (value?: string) => {
  if (!value) return 'Non renseignée';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fr-FR');
};

interface PromptMatrixProps {
  projectId: string;
  prompts: PromptRow[];
  providers?: Array<{ id: string; label: string }>;
  onEditPrompt?: (promptId: string | number) => void;
}

export default function PromptMatrix({
  projectId,
  prompts,
  providers = [
    { id: 'chatgpt', label: 'ChatGPT' },
    { id: 'claude', label: 'Claude' },
    { id: 'perplexity', label: 'Perplexity' },
    { id: 'gemini', label: 'Gemini' },
  ],
  onEditPrompt,
}: PromptMatrixProps) {
  const [expandedId, setExpandedId] = useState<string | number | null>(null);
  const [stats, setStats] = useState<Record<string, PromptStatsData>>({});
  const [loadingId, setLoadingId] = useState<string | number | null>(null);
  const [statsErrors, setStatsErrors] = useState<Record<string, string>>({});

  const toggleStats = async (promptId: string | number) => {
    if (expandedId === promptId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(promptId);
    setLoadingId(promptId);
    setStatsErrors((current) => ({ ...current, [String(promptId)]: '' }));
    try {
      const data = await api.getPromptStats(projectId, promptId);
      setStats((current) => ({ ...current, [String(promptId)]: data }));
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setStatsErrors((current) => ({
        ...current,
        [String(promptId)]: detail || 'Impossible de charger les statistiques de ce prompt.',
      }));
    } finally {
      setLoadingId((current) => current === promptId ? null : current);
    }
  };

  return (
    <div className="table-wrap overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="geo-table w-full min-w-[900px] text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
          <tr>
            <th className="w-24 px-4 py-3 text-left">ID</th>
            <th className="px-4 py-3 text-left">Prompt</th>
            {providers.map((provider) => (
              <th key={provider.id} className="px-4 py-3 text-left">{provider.label}</th>
            ))}
            <th className="px-4 py-3 text-right">Dernier scan</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {prompts.map((prompt) => {
            const expanded = expandedId === prompt.id;
            return (
              <PromptRows
                key={prompt.id}
                prompt={prompt}
                providers={providers}
                expanded={expanded}
                onToggle={() => toggleStats(prompt.id)}
                onEditPrompt={onEditPrompt}
                stats={stats[String(prompt.id)]}
                loading={loadingId === prompt.id}
                error={statsErrors[String(prompt.id)]}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PromptRows({
  prompt,
  providers,
  expanded,
  onToggle,
  onEditPrompt,
  stats,
  loading,
  error,
}: {
  prompt: PromptRow;
  providers: Array<{ id: string; label: string }>;
  expanded: boolean;
  onToggle: () => void;
  onEditPrompt?: (promptId: string | number) => void;
  stats?: PromptStatsData;
  loading: boolean;
  error?: string;
}) {
  return (
    <>
      <tr className="border-t border-slate-100 transition-colors hover:bg-slate-50/50 dark:border-slate-700/50 dark:hover:bg-slate-800/30">
        <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-500" title={String(prompt.id)}>
          {shortId(prompt.id)}
        </td>
        <td className="max-w-[360px] px-4 py-3 font-medium text-slate-900 dark:text-white">
          <button type="button" onClick={onToggle} className="block w-full truncate text-left hover:text-blue-600" title="Afficher les statistiques détaillées">
            {prompt.prompt}
          </button>
        </td>
        {providers.map((provider) => (
          <td key={provider.id} className="px-4 py-3">
            <span title={String(prompt[`${provider.id}_error`] ?? '')}>
              {statusBadge((prompt[provider.id] as MentionStatus | undefined) ?? 'not_scanned')}
            </span>
          </td>
        ))}
        <td className="whitespace-nowrap px-4 py-3 text-right text-slate-500">{prompt.date || '—'}</td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onToggle}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {expanded ? 'Réduire' : 'Statistiques'}
            </button>
            {onEditPrompt && (
              <button
                type="button"
                onClick={() => onEditPrompt(prompt.id)}
                className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
              >
                Modifier
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-blue-100 bg-blue-50/40 dark:border-blue-500/10 dark:bg-blue-500/5">
          <td colSpan={providers.length + 4} className="px-4 py-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Prompt complet</p>
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{prompt.prompt}</p>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <Info label="ID complet" value={String(prompt.id)} mono />
                <Info label="Thème" value={prompt.theme || 'Général'} />
                <Info label="Créé le" value={formatCreatedAt(prompt.createdAt)} />
                <Info label="Dernier scan" value={prompt.date || 'Jamais scanné'} />
              </dl>
            </div>
            <div className="mt-4 border-t border-blue-100 pt-4 dark:border-blue-500/10">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
                  Chargement des statistiques…
                </div>
              ) : error ? (
                <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">{error}</p>
              ) : stats ? (
                <PromptStatistics stats={stats} />
              ) : null}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function PromptStatistics({ stats }: { stats: PromptStatsData }) {
  const overall = stats.overall;
  return (
    <div className="space-y-5">
      <div>
        <h4 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Performance historique du prompt</h4>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
          <Metric label="Scans lancés" value={String(overall.total)} />
          <Metric label="Réponses exploitables" value={`${overall.successful}/${overall.total}`} />
          <Metric label="Taux de citation" value={`${overall.mention_rate}%`} detail={`${overall.mentions}/${overall.successful}`} tone={overall.mention_rate >= 50 ? 'good' : 'warn'} />
          <Metric label="URL présente" value={`${overall.url_rate}%`} detail={`${overall.url_found}/${overall.successful}`} />
          <Metric label="Marque présente" value={`${overall.brand_rate}%`} detail={`${overall.brand_found}/${overall.successful}`} />
          <Metric label="Erreurs" value={String(overall.failed)} tone={overall.failed ? 'bad' : 'good'} />
          <Metric label="Rang moyen" value={overall.average_rank == null ? '—' : `#${overall.average_rank}`} />
          <Metric label="Latence moyenne" value={overall.average_latency_ms == null ? '—' : `${overall.average_latency_ms} ms`} />
          <Metric label="Tokens cumulés" value={overall.tokens_used.toLocaleString('fr-FR')} />
          <Metric label="Coût cumulé" value={`$${overall.cost.toFixed(6)}`} />
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Les taux sont calculés sur les réponses exploitables uniquement : les erreurs techniques sont affichées séparément.
        </p>
      </div>

      {stats.by_model.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">Comparaison par modèle</h4>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-400 dark:bg-slate-800/70">
                <tr>
                  <th className="px-3 py-2">Modèle</th><th className="px-3 py-2">Citations</th><th className="px-3 py-2">URL</th>
                  <th className="px-3 py-2">Marque</th><th className="px-3 py-2">Rang moy.</th><th className="px-3 py-2">Erreurs</th>
                  <th className="px-3 py-2">Latence</th><th className="px-3 py-2 text-right">Coût</th>
                </tr>
              </thead>
              <tbody>
                {stats.by_model.map((modelStats) => {
                  const model = modelDisplay(modelStats.model);
                  return (
                    <tr key={modelStats.model} className="border-t border-slate-100 dark:border-slate-700/60">
                      <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200" title={modelStats.model}>{model.label}</td>
                      <td className="px-3 py-2">{modelStats.mention_rate}% <span className="text-slate-400">({modelStats.mentions}/{modelStats.successful})</span></td>
                      <td className="px-3 py-2">{modelStats.url_rate}%</td>
                      <td className="px-3 py-2">{modelStats.brand_rate}%</td>
                      <td className="px-3 py-2">{modelStats.average_rank == null ? '—' : `#${modelStats.average_rank}`}</td>
                      <td className="px-3 py-2">{modelStats.failed}</td>
                      <td className="px-3 py-2">{modelStats.average_latency_ms == null ? '—' : `${modelStats.average_latency_ms} ms`}</td>
                      <td className="px-3 py-2 text-right">${modelStats.cost.toFixed(6)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stats.recent.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">10 derniers résultats</h4>
          <div className="grid gap-2 md:grid-cols-2">
            {stats.recent.map((result) => {
              const model = modelDisplay(result.model);
              return (
                <div key={result.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900/50">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800 dark:text-slate-200">{model.label}</p>
                    <p className="text-slate-400">{result.scanned_at ? new Date(result.scanned_at).toLocaleString('fr-FR') : 'Date inconnue'}</p>
                  </div>
                  <Badge variant={result.error ? 'amber' : result.mentioned ? 'emerald' : 'red'}>
                    {result.error ? 'Erreur' : result.mentioned ? `Cité${result.rank != null ? ` #${result.rank}` : ''}` : 'Absent'}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const toneClass = {
    neutral: 'text-slate-900 dark:text-white',
    good: 'text-emerald-700 dark:text-emerald-300',
    warn: 'text-amber-700 dark:text-amber-300',
    bad: 'text-red-700 dark:text-red-300',
  }[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/50">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-lg font-bold ${toneClass}`}>{value}</p>
      {detail && <p className="text-[10px] text-slate-400">{detail}</p>}
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900/50">
      <dt className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-1 break-all text-slate-700 dark:text-slate-200 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}
