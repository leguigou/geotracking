import { useEffect, useMemo, useState } from 'react';
import api, { type AuditLogEntry } from '../lib/api';

const actionLabels: Record<string, string> = {
  'project.created': 'Création du projet',
  'project.updated': 'Modification du projet',
  'project.deleted': 'Suppression du projet',
  'prompt.updated': 'Modification du prompt',
  'scan.started': 'Scan lancé',
  'scan.cancelled': 'Scan annulé',
};

const actionStyle = (action: string) => {
  if (action === 'project.deleted' || action === 'scan.cancelled') {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300';
  }
  if (action === 'project.created' || action === 'scan.started') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';
  }
  if (action === 'project.updated' || action === 'prompt.updated') {
    return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300';
  }
  return 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'medium' }) : '—';

const displayValue = (value: unknown) => {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedFilter(filter.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [filter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setExpandedId(null);
    api.getAuditLogs({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      search: debouncedFilter,
    })
      .then((data) => {
        if (!cancelled) {
          setLogs([...data.items].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          ));
          setTotal(data.total);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedFilter, page, pageSize]);

  const summary = useMemo(() => ({
    total,
    visible: logs.length,
    users: new Set(logs.map((log) => log.user_id)).size,
    scans: logs.filter((log) => log.action.startsWith('scan.')).length,
  }), [logs, total]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Logs d’activité</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Du plus récent au plus ancien. Déplie une action pour afficher toutes les informations enregistrées.
          </p>
        </div>
        <div className="flex w-full gap-2 lg:w-auto">
          <input
            type="search"
            className="input-field min-w-0 flex-1 text-sm py-2 lg:w-72"
            placeholder="Action, projet, utilisateur, identifiant..."
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          {filter && <button onClick={() => setFilter('')} className="btn-secondary shrink-0 text-xs">Effacer</button>}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Summary label={debouncedFilter ? 'Résultats trouvés' : 'Actions au total'} value={summary.total} />
        <Summary label="Affichées sur cette page" value={summary.visible} />
        <Summary label="Utilisateurs sur la page" value={summary.users} />
        <Summary label="Scans sur la page" value={summary.scans} />
      </div>

      <PaginationControls
        page={page}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
        disabled={loading}
        onPageChange={setPage}
        onPageSizeChange={(value) => {
          setPageSize(value);
          setPage(1);
        }}
      />

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">Chargement...</p>
      ) : logs.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">
          {filter ? 'Aucun log ne correspond à cette recherche.' : 'Aucun log pour le moment.'}
        </p>
      ) : (
        <>
          <div className="space-y-3">
          {logs.map((log) => {
            const expanded = expandedId === log.id;
            return (
              <article key={log.id} className="glass-card overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : log.id)}
                  className="flex w-full flex-col gap-3 p-4 text-left transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40 sm:flex-row sm:items-center"
                  aria-expanded={expanded}
                >
                  <span className={`inline-flex w-fit shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold ${actionStyle(log.action)}`}>
                    {actionLabels[log.action] || log.action}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {log.user_name || log.user_email || 'Utilisateur'}
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {log.resource_type}
                      </span>
                    </div>
                    <p className="mt-1 break-words font-mono text-[11px] text-slate-400">
                      {log.resource_id || 'Aucune ressource associée'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-4 text-xs text-slate-400 sm:flex-col sm:items-end">
                    <span>{formatDate(log.created_at)}</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">{expanded ? 'Replier' : 'Tout afficher'}</span>
                  </div>
                </button>

                {expanded && (
                  <div className="space-y-5 border-t border-slate-200 p-4 dark:border-slate-700 sm:p-5">
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <Info label="ID du log" value={log.id} mono />
                      <Info label="Organisation" value={log.organization_id} mono />
                      <Info label="ID utilisateur" value={log.user_id} mono />
                      <Info label="Adresse IP" value={log.ip_address || 'Non enregistrée'} mono />
                      <Info label="Action technique" value={log.action} mono />
                      <Info label="Type de ressource" value={log.resource_type} />
                      <Info label="ID ressource" value={log.resource_id || '—'} mono />
                      <Info label="Date ISO" value={log.created_at} mono />
                      <Info label="Utilisateur" value={log.user_name || '—'} />
                      <Info label="Email" value={log.user_email || '—'} />
                    </div>

                    <section>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Détails de l’action</p>
                          <p className="text-xs text-slate-400">Payload complet enregistré au moment de l’action.</p>
                        </div>
                        {log.details && (
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(JSON.stringify(log.details, null, 2))}
                            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                          >
                            Copier le JSON
                          </button>
                        )}
                      </div>

                      {log.details && Object.keys(log.details).length > 0 ? (
                        <>
                          <div className="mb-3 grid gap-2 sm:grid-cols-2">
                            {Object.entries(log.details).map(([key, value]) => (
                              <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                                <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-slate-400">{key}</p>
                                <pre className="whitespace-pre-wrap break-words font-sans text-sm text-slate-700 dark:text-slate-200">{displayValue(value)}</pre>
                              </div>
                            ))}
                          </div>
                          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200 dark:border-slate-700">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </>
                      ) : (
                        <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400 dark:border-slate-700">
                          Aucun détail supplémentaire enregistré pour cette action.
                        </p>
                      )}
                    </section>
                  </div>
                )}
              </article>
            );
          })}
          </div>
          <PaginationControls
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            disabled={loading}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
            bottom
          />
        </>
      )}
    </div>
  );
}

function PaginationControls({
  page,
  pageSize,
  total,
  totalPages,
  disabled,
  onPageChange,
  onPageSizeChange,
  bottom = false,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  disabled: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  bottom?: boolean;
}) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${bottom ? 'mt-5' : 'mb-4'}`}>
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <label htmlFor={bottom ? 'logs-page-size-bottom' : 'logs-page-size'}>Résultats par page</label>
        <select
          id={bottom ? 'logs-page-size-bottom' : 'logs-page-size'}
          value={pageSize}
          disabled={disabled}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="input-field w-24 py-1.5 text-sm"
        >
          {[50, 100, 250, 500].map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
        <span className="hidden md:inline">• {first}–{last} sur {total}</span>
      </div>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Page {page} sur {totalPages}
        </span>
        <button
          type="button"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
        >
          Précédente
        </button>
        <button
          type="button"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
        >
          Suivante
        </button>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/50">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 break-all text-xs font-semibold text-slate-800 dark:text-slate-200 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
