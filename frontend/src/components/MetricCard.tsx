import type { ReactNode } from 'react'

interface MetricCardProps {
  title: string
  value: string | number
  trend?: string
  trendColor?: string
  children?: ReactNode
}

export default function MetricCard({ value, trend, trendColor = 'text-emerald-600 dark:text-emerald-400', children }: MetricCardProps) {
  return (
    <div className="rounded-xl p-5 transition-all duration-200 cursor-default bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 hover:shadow-md">
      {children}
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold text-slate-900 dark:text-white num">{value}</span>
        {trend && (
          <span className={`text-xs font-medium ${trendColor}`}>{trend}</span>
        )}
      </div>
    </div>
  )
}
