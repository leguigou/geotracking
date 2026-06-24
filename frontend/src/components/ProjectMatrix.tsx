import Badge from './Badge';

interface ProjectRow {
  name: string;
  chatgpt: number | null;
  claude: number | null;
  perplexity: number | null;
  gemini: number | null;
  grok: number | null;
  deepseek: number | null;
  sovAvg: number;
  onClick?: () => void;
}

interface ProjectMatrixProps {
  projects: ProjectRow[];
}

function sovBadge(val: number | null) {
  if (val == null) return <Badge variant="slate">N/A</Badge>;
  if (val >= 30) return <Badge variant="emerald">{val}%</Badge>;
  if (val >= 10) return <Badge variant="amber">{val}%</Badge>;
  return <Badge variant="red">{val}%</Badge>;
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
              <td className="px-4 py-3">{sovBadge(p.chatgpt)}</td>
              <td className="px-4 py-3">{sovBadge(p.claude)}</td>
              <td className="px-4 py-3">{sovBadge(p.perplexity)}</td>
              <td className="px-4 py-3">{sovBadge(p.gemini)}</td>
              <td className="px-4 py-3">{sovBadge(p.grok)}</td>
              <td className="px-4 py-3">{sovBadge(p.deepseek)}</td>
              <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">{p.sovAvg}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
