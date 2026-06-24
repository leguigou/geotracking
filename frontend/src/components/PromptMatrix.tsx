import { getLlmInfo, type PromptMatrixRow } from '../lib/dataTransform';

interface PromptMatrixProps {
  prompts: PromptMatrixRow[];
}

export default function PromptMatrix({ prompts }: PromptMatrixProps) {
  // Collecter tous les modèles uniques présents dans les résultats
  const allModels = new Set<string>();
  for (const row of prompts) {
    for (const model of Object.keys(row.models)) {
      allModels.add(model);
    }
  }
  const modelList = Array.from(allModels).sort();

  if (prompts.length === 0) {
    return <p className="text-sm text-slate-400 py-4">Aucun résultat à afficher.</p>;
  }

  return (
    <div className="table-wrap overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="geo-table w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
          <tr>
            <th className="px-4 py-3 text-left w-8">#</th>
            <th className="px-4 py-3 text-left min-w-[200px]">Prompt</th>
            {modelList.map((model) => (
              <th key={model} className="px-4 py-3 text-left">{getLlmInfo(model).label}</th>
            ))}
            <th className="px-4 py-3 text-right">Date</th>
          </tr>
        </thead>
        <tbody>
          {prompts.map((row, idx) => (
            <tr key={row.id} className="border-t border-slate-100 dark:border-slate-700/50 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
              <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
              <td className="px-4 py-3 max-w-[280px] truncate font-medium text-slate-900 dark:text-white" title={row.prompt}>
                {row.prompt.length > 60 ? row.prompt.slice(0, 60) + '…' : row.prompt}
              </td>
              {modelList.map((model) => {
                const m = row.models[model];
                const badgeType = !m ? 'none' : m.hasBrand || m.hasUrl ? 'mentioned' : 'absent';
                return (
                  <td key={model} className="px-4 py-3">
                    {badgeType === 'mentioned' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                        ✅
                      </span>
                    )}
                    {badgeType === 'absent' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20">
                        ❌
                      </span>
                    )}
                    {badgeType === 'none' && (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>
                );
              })}
              <td className="px-4 py-3 text-right text-slate-500 text-xs">{row.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
