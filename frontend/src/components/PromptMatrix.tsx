import Badge from './Badge';

interface PromptRow {
  id: number;
  prompt: string;
  chatgpt: boolean;
  claude: boolean;
  perplexity: boolean;
  gemini: boolean;
  date: string;
}

interface PromptMatrixProps {
  prompts: PromptRow[];
}

export default function PromptMatrix({ prompts }: PromptMatrixProps) {
  return (
    <div className="table-wrap overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="geo-table w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
          <tr>
            <th className="px-4 py-3 text-left w-8">#</th>
            <th className="px-4 py-3 text-left">Prompt</th>
            <th className="px-4 py-3 text-left">ChatGPT</th>
            <th className="px-4 py-3 text-left">Claude</th>
            <th className="px-4 py-3 text-left">Perplexity</th>
            <th className="px-4 py-3 text-left">Gemini</th>
            <th className="px-4 py-3 text-right">Date</th>
          </tr>
        </thead>
        <tbody>
          {prompts.map((p) => (
            <tr key={p.id} className="border-t border-slate-100 dark:border-slate-700/50 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
              <td className="px-4 py-3 text-slate-400">{p.id}</td>
              <td className="px-4 py-3 max-w-[280px] truncate font-medium text-slate-900 dark:text-white">{p.prompt}</td>
              <td className="px-4 py-3">
                {p.chatgpt ? <Badge variant="emerald">✅ Mentionné</Badge> : <Badge variant="red">❌ Absent</Badge>}
              </td>
              <td className="px-4 py-3">
                {p.claude ? <Badge variant="emerald">✅ Mentionné</Badge> : <Badge variant="red">❌ Absent</Badge>}
              </td>
              <td className="px-4 py-3">
                {p.perplexity ? <Badge variant="emerald">✅ Mentionné</Badge> : <Badge variant="red">❌ Absent</Badge>}
              </td>
              <td className="px-4 py-3">
                {p.gemini ? <Badge variant="emerald">✅ Mentionné</Badge> : <Badge variant="red">❌ Absent</Badge>}
              </td>
              <td className="px-4 py-3 text-right text-slate-500">{p.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
