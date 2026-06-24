import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'emerald' | 'amber' | 'red' | 'blue' | 'slate';
  className?: string;
}

const variants = {
  emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20',
  amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20',
  red: 'bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20',
  blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20',
  slate: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20',
};

export default function Badge({ children, variant = 'slate', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
