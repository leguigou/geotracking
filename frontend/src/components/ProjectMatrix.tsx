import Badge from './Badge';
import type { ProviderStats } from '../lib/api';
import { modelDisplay } from '../lib/modelMap';

export interface ProjectMatrixRow {
  id: string;
  name: string;
  stats: Record<string, ProviderStats>;
  sovAvg: number | null;
  onClick?: () => void;
}

interface ProjectMatrixProps {
  projects: ProjectMatrixRow[];
  models: string[];
}

function sovBadge(stats?: ProviderStats) {
  if (!stats) return <Badge variant="slate">N/A</Badge>;
  const variant: 'emerald' | 'amber' | 'red' = stats.sov >= 30 ? 'emerald' : stats.sov >= 10 ? 'amber' : 'red';
  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Badge variant={variant}>{stats.sov}%</Badge>
      <span className="text-[10px] text-slate-400">{stats.mentions}/{stats.total}</span>
    </div>
  );
}

export default function ProjectMatrix({ projects, models }: ProjectMatrixProps) {
  return (
    <div className="table-wrap overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="geo-table min-w-full text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
          <tr>
            <th className="sticky left-0 z-10 min-w-48 bg-slate-50 px-4 py-3 text-left dark:bg-slate-800">Projet</th>
            {models.map((modelId) => {
              const display = modelDisplay(modelId);
              return (
                <th key={modelId} className="min-w-36 px-4 py-3 text-left normal-case" title={modelId}>
                  <span className="block truncate">{display.label}</span>
                  <span className="block truncate font-mono text-[9px] font-normal text-slate-400">{modelId}</span>
                </th>
              );
            })}
            <th className="min-w-24 px-4 py-3 text-right">SOV moy.</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr
              key={project.id}
              onClick={project.onClick}
              className="cursor-pointer border-t border-slate-100 transition-colors hover:bg-slate-50/50 dark:border-slate-700/50 dark:hover:bg-slate-800/30"
            >
              <td className="sticky left-0 z-10 bg-white px-4 py-3 font-medium text-slate-900 group-hover:bg-slate-50 dark:bg-slate-900 dark:text-white">
                {project.name}
              </td>
              {models.map((modelId) => (
                <td key={modelId} className="px-4 py-3">{sovBadge(project.stats[modelId])}</td>
              ))}
              <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
                {project.sovAvg == null ? '—' : `${project.sovAvg}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
