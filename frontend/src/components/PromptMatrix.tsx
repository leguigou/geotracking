import Badge from './Badge';

interface PromptRow {
  id: number | string;
  prompt: string;
  date: string;
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

interface PromptMatrixProps {
  prompts: PromptRow[];
  providers?: Array<{ id: string; label: string }>;
}

export default function PromptMatrix({ prompts, providers = [
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'claude', label: 'Claude' },
  { id: 'perplexity', label: 'Perplexity' },
  { id: 'gemini', label: 'Gemini' },
] }: PromptMatrixProps) {
  return (
    <div className="table-wrap overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="geo-table w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
          <tr>
            <th className="px-4 py-3 text-left w-8">#</th>
          <th className="px-4 py-3 text-left">Prompt</th>
            {providers.map((provider) => (
              <th key={provider.id} className="px-4 py-3 text-left">{provider.label}</th>
            ))}
            <th className="px-4 py-3 text-right">Date</th>
          </tr>
        </thead>
        <tbody>
          {prompts.map((p) => (
            <tr key={p.id} className="border-t border-slate-100 dark:border-slate-700/50 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
              <td className="px-4 py-3 text-slate-400">{p.id}</td>
              <td className="px-4 py-3 max-w-[280px] truncate font-medium text-slate-900 dark:text-white">{p.prompt}</td>
              {providers.map((provider) => (
                <td key={provider.id} className="px-4 py-3">
                  <span title={String(p[`${provider.id}_error`] ?? '')}>
                    {statusBadge((p[provider.id] as MentionStatus | undefined) ?? 'not_scanned')}
                  </span>
                </td>
              ))}
              <td className="px-4 py-3 text-right text-slate-500">{p.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
