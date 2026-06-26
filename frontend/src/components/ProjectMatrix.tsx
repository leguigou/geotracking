import Badge from './Badge';
import type { ProviderStats } from '../lib/api';

interface ProjectRow {
  name: string;
  chatgpt: number | null;
  chatgptStats?: ProviderStats | null;
  claude: number | null;
  claudeStats?: ProviderStats | null;
  perplexity: number | null;
  perplexityStats?: ProviderStats | null;
  gemini: number | null;
  geminiStats?: ProviderStats | null;
  grok: number | null;
  grokStats?: ProviderStats | null;
  deepseek: number | null;
  deepseekStats?: ProviderStats | null;
  sovAvg: number;
  onClick?: () => void;
}

interface ProjectMatrixProps {
  projects: ProjectRow[];
}

function sovBadge(val: number | null, stats?: ProviderStats | null) {
  if (val == null || !stats) return <Badge variant="slate">N/A</Badge>;
  const variant: 'emerald' | 'amber' | 'red' = val >= 30 ? 'emerald' : val >= 10 ? 'amber' : 'red';
  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Badge variant={variant}>{val}%</Badge>
      <span className="text-[10px] text-slate-400">{stats.mentions}/{stats.total}</span>
    </div>
  );
}

export default function ProjectMatrix({ projects }: ProjectMatrixProps) {
  return (
    <div className="table-wrap overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="geo-table w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
          <tr>
            <th className="px-4 py-3 text-left">Projet</th>
            <th className="px-4 py-3 text-left">ChatGPT</th>
            <th className="px-4 py-3 text-left">Claude</th>
            <th className="px-4 py-3 text-left">Perplexity</th>
            <th className="px-4 py-3 text-left">Gemini</th>
            <th className="px-4 py-3 text-left">Grok</th>
            <th className="px-4 py-3 text-left">DeepSeek</th>
            <th className="px-4 py-3 text-right">SOV Moy.</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p, i) => (
            <tr
              key={i}
              onClick={p.onClick}
              className="border-t border-slate-100 dark:border-slate-700/50 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30 cursor-pointer"
            >
              <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{p.name}</td>
              <td className="px-4 py-3">{sovBadge(p.chatgpt, p.chatgptStats)}</td>
              <td className="px-4 py-3">{sovBadge(p.claude, p.claudeStats)}</td>
              <td className="px-4 py-3">{sovBadge(p.perplexity, p.perplexityStats)}</td>
              <td className="px-4 py-3">{sovBadge(p.gemini, p.geminiStats)}</td>
              <td className="px-4 py-3">{sovBadge(p.grok, p.grokStats)}</td>
              <td className="px-4 py-3">{sovBadge(p.deepseek, p.deepseekStats)}</td>
              <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">{p.sovAvg}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
