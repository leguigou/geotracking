import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import InspectModal from './InspectModal';

interface ScanEntry {
  id: string;
  model: string;
  has_url: boolean;
  has_brand: boolean;
  rank?: number | null;
  scanned_at: string;
  response_text?: string | null;
  prompt_text?: string;
}

interface Props {
  projectId: string;
  onClose: () => void;
}

export default function ScanHistory({ projectId, onClose }: Props) {
  const [results, setResults] = useState<ScanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [inspect, setInspect] = useState<{ llm: string; prompt: string; response: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await api.getResults(projectId);
        if (cancelled) return;
        const list = Array.isArray(raw) ? raw : [];
        // Trier par date décroissante
        list.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
          const da = String(a.scanned_at ?? '');
          const db = String(b.scanned_at ?? '');
          return db.localeCompare(da);
        });
        setResults(list as ScanEntry[]);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const modelBadge = (model: string) => {
    const colors: Record<string, string> = {
      chatgpt: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      claude: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
      perplexity: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
      gemini: 'bg-red-500/10 text-red-700 dark:text-red-300',
      grok: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    };
    const key = Object.keys(colors).find((k) => model.toLowerCase().includes(k));
    return colors[key || ''] || 'bg-slate-500/10 text-slate-700 dark:text-slate-300';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 pb-8 bg-black/40 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Historique des scans</h3>
            <p className="text-xs text-slate-500 mt-0.5">Réponses brutes des providers pour chaque prompt</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <p className="text-sm text-slate-400 text-center py-8">Chargement...</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Aucun scan effectué pour ce projet.</p>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {results.map((r, i) => (
                <div
                  key={r.id || i}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-sm transition-shadow"
                >
                  {/* Header de l'entrée */}
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${modelBadge(r.model)}`}>
                      {r.model.split('/').pop() || r.model}
                    </span>
                    <span className="text-xs text-slate-400">
                      {r.scanned_at ? new Date(r.scanned_at).toLocaleString('fr-FR') : '—'}
                    </span>
                    <span className="ml-auto flex items-center gap-3 text-xs">
                      <span className={r.has_url ? 'text-emerald-600' : 'text-red-500'}>
                        {r.has_url ? '🔗 URL trouvée' : '🔗 Non trouvée'}
                      </span>
                      <span className={r.has_brand ? 'text-emerald-600' : 'text-red-500'}>
                        {r.has_brand ? '🏷️ Marque' : '🏷️ Absente'}
                      </span>
                      {r.rank != null && (
                        <span className="text-slate-500"># {r.rank}</span>
                      )}
                      {r.latency_ms != null && (
                        <span className="text-slate-400">{r.latency_ms}ms</span>
                      )}
                    </span>
                  </div>

                  {/* Réponse brute */}
                  {r.response_text ? (
                    <div className="px-4 py-3">
                      <pre className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {r.response_text.length > 1500
                          ? r.response_text.slice(0, 1500) + '...'
                          : r.response_text}
                      </pre>
                      <button
                        onClick={() => setInspect({
                          llm: r.model.split('/').pop() || r.model,
                          prompt: `Scan du ${r.scanned_at ? new Date(r.scanned_at).toLocaleString('fr-FR') : '?'}`,
                          response: r.response_text || '',
                        })}
                        className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Voir la réponse complète →
                      </button>
                    </div>
                  ) : (
                    <p className="px-4 py-3 text-xs text-slate-400 italic">Aucune réponse stockée</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 pb-5 pt-3 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="btn-primary">Fermer</button>
        </div>
      </div>

      {inspect && (
        <InspectModal
          open={true}
          onClose={() => setInspect(null)}
          llm={inspect.llm}
          prompt={inspect.prompt}
          responseSnippet={inspect.response}
          mentioned={true}
        />
      )}
    </div>
  );
}
