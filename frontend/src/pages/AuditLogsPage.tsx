import { useState, useEffect } from 'react';
import api from '../lib/api';

interface LogEntry {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const actionLabels: Record<string, string> = {
  'project.created': 'Création projet',
  'project.updated': 'Modification projet',
  'project.deleted': 'Suppression projet',
  'scan.started': 'Scan lancé',
  'scan.cancelled': 'Scan annulé',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await api.getAuditLogs();
        if (cancelled) setLogs(Array.isArray(raw) ? (raw as LogEntry[]) : []);
        else setLogs(Array.isArray(raw) ? (raw as LogEntry[]) : []);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = filter
    ? logs.filter((l) => l.action.includes(filter) || l.resource_type.includes(filter))
    : logs;

  const actionColor = (action: string) => {
    if (action.startsWith('project.created') || action.startsWith('scan.started')) return 'text-emerald-600 dark:text-emerald-400';
    if (action.startsWith('project.deleted') || action.startsWith('scan.cancelled')) return 'text-red-600 dark:text-red-400';
    return 'text-slate-600 dark:text-slate-400';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Logs d'activité</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Historique timestampé de toutes les actions</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            className="input-field text-sm py-2 w-48"
            placeholder="Filtrer par action..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button onClick={() => setFilter('')} className="btn-secondary text-xs">Réinitialiser</button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-12">Chargement...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-12">Aucun log pour le moment.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => (
            <div
              key={log.id}
              className="glass-card rounded-xl px-5 py-3 flex items-center gap-4 text-sm"
            >
              <span className="text-xs text-slate-400 font-mono w-32 shrink-0">
                {log.created_at ? new Date(log.created_at).toLocaleString('fr-FR') : '—'}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${actionColor(log.action)} bg-slate-100 dark:bg-slate-800`}>
                {actionLabels[log.action] || log.action}
              </span>
              <span className="text-xs text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                {log.resource_type}
              </span>
              {log.resource_id && (
                <span className="text-xs font-mono text-slate-500 truncate max-w-[120px]">
                  {log.resource_id.slice(0, 12)}...
                </span>
              )}
              {log.details && (
                <span className="text-xs text-slate-400 ml-auto truncate max-w-[200px]">
                  {JSON.stringify(log.details).slice(0, 60)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
