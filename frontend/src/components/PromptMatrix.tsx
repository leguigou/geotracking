import { useState } from 'react';
import Badge from './Badge';

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
  prompts: PromptRow[];
  providers?: Array<{ id: string; label: string }>;
  onEditPrompt?: (promptId: string | number) => void;
}

export default function PromptMatrix({
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
                onToggle={() => setExpandedId(expanded ? null : prompt.id)}
                onEditPrompt={onEditPrompt}
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
}: {
  prompt: PromptRow;
  providers: Array<{ id: string; label: string }>;
  expanded: boolean;
  onToggle: () => void;
  onEditPrompt?: (promptId: string | number) => void;
}) {
  return (
    <>
      <tr className="border-t border-slate-100 transition-colors hover:bg-slate-50/50 dark:border-slate-700/50 dark:hover:bg-slate-800/30">
        <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-500" title={String(prompt.id)}>
          {shortId(prompt.id)}
        </td>
        <td className="max-w-[360px] px-4 py-3 font-medium text-slate-900 dark:text-white">
          <p className="truncate" title={prompt.prompt}>{prompt.prompt}</p>
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
              {expanded ? 'Réduire' : 'Plus d’infos'}
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
          </td>
        </tr>
      )}
    </>
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
