import React, { ReactNode, ComponentType } from 'react';
import { LucideProps } from 'lucide-react';

export type MetricColor = 'indigo' | 'cyan' | 'emerald' | 'amber';

export interface MetricCardProps {
  title: string;
  value: ReactNode;
  subtext?: ReactNode;
  icon?: ComponentType<LucideProps>;
  color?: MetricColor;
  progress?: number | null;
}

export function MetricCard({
  title,
  value,
  subtext,
  icon: Icon,
  color = 'indigo',
  progress = null
}: MetricCardProps) {
  const colorMap: Record<MetricColor, { bg: string; bar: string }> = {
    indigo: {
      bg: 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
      bar: 'bg-gradient-to-r from-indigo-500 to-indigo-400'
    },
    cyan: {
      bg: 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
      bar: 'bg-gradient-to-r from-cyan-500 to-sky-400'
    },
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
      bar: 'bg-gradient-to-r from-emerald-500 to-emerald-400'
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400',
      bar: 'bg-gradient-to-r from-amber-500 to-amber-400'
    }
  };

  const scheme = colorMap[color] || colorMap.indigo;

  return (
    <div className="glass-card flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
          {title}
        </span>
        {Icon && (
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${scheme.bg}`}>
            <Icon size={18} />
          </div>
        )}
      </div>

      <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
        {value}
      </div>

      {progress !== null && (
        <div className="mt-1 mb-2">
          <div className="progress-bar-bg">
            <div
              className={`progress-bar-fill ${scheme.bar}`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      )}

      {subtext && (
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-auto">
          {subtext}
        </div>
      )}
    </div>
  );
}
