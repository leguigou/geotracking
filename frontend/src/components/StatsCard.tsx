import type { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  trend: string;
  trendColor?: string;
  bgColor?: string;
  iconBg?: string;
  pulse?: boolean;
}

export default function StatsCard({ title, value, icon, trend, trendColor = 'text-emerald-600 dark:text-emerald-400', bgColor = 'bg-white dark:bg-slate-800/50', iconBg = 'bg-blue-500/10', pulse }: StatsCardProps) {
  return (
    <div className={`kpi-card relative overflow-hidden rounded-xl p-5 transition-all duration-200 ${bgColor} border ${bgColor.includes('white') ? 'border-slate-200' : 'border-slate-700/50'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1 num">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        {pulse && <span className="pulse-dot" />}
        <span className={`text-xs font-medium ${trendColor}`}>{trend}</span>
      </div>
    </div>
  );
}
