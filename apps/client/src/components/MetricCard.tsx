import React, { ReactNode, ComponentType } from 'react';
import { LucideProps } from 'lucide-react';

export type MetricColor = 'indigo' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet';

export interface MetricCardProps {
  title: string;
  value: ReactNode;
  subtext?: ReactNode;
  icon?: ComponentType<LucideProps>;
  color?: MetricColor;
  progress?: number | null;
  badge?: string;
  trend?: {
    label: string;
    positive?: boolean;
  };
}

export function MetricCard({
  title,
  value,
  subtext,
  icon: Icon,
  color = 'indigo',
  progress = null,
  badge,
  trend,
}: MetricCardProps) {
  const colorMap: Record<
    MetricColor,
    {
      bgIcon: string;
      iconText: string;
      bar: string;
      glow: string;
      badgeStyle: string;
    }
  > = {
    indigo: {
      bgIcon: 'bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/20',
      iconText: 'text-indigo-600 dark:text-indigo-400',
      bar: 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.5)]',
      glow: 'hover:shadow-[0_8px_30px_rgba(99,102,241,0.12)]',
      badgeStyle: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
    },
    cyan: {
      bgIcon: 'bg-cyan-500/10 dark:bg-cyan-500/20 border border-cyan-500/20',
      iconText: 'text-cyan-600 dark:text-cyan-400',
      bar: 'bg-gradient-to-r from-cyan-500 via-teal-400 to-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.5)]',
      glow: 'hover:shadow-[0_8px_30px_rgba(6,182,212,0.12)]',
      badgeStyle: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
    },
    emerald: {
      bgIcon: 'bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20',
      iconText: 'text-emerald-600 dark:text-emerald-400',
      bar: 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
      glow: 'hover:shadow-[0_8px_30px_rgba(16,185,129,0.12)]',
      badgeStyle: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    },
    amber: {
      bgIcon: 'bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20',
      iconText: 'text-amber-600 dark:text-amber-400',
      bar: 'bg-gradient-to-r from-amber-500 via-orange-400 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
      glow: 'hover:shadow-[0_8px_30px_rgba(245,158,11,0.12)]',
      badgeStyle: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    },
    rose: {
      bgIcon: 'bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/20',
      iconText: 'text-rose-600 dark:text-rose-400',
      bar: 'bg-gradient-to-r from-rose-500 via-red-500 to-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]',
      glow: 'hover:shadow-[0_8px_30px_rgba(244,63,94,0.12)]',
      badgeStyle: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    },
    violet: {
      bgIcon: 'bg-purple-500/10 dark:bg-purple-500/20 border border-purple-500/20',
      iconText: 'text-purple-600 dark:text-purple-400',
      bar: 'bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.5)]',
      glow: 'hover:shadow-[0_8px_30px_rgba(168,85,247,0.12)]',
      badgeStyle: 'bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
    },
  };

  const scheme = colorMap[color] || colorMap.indigo;

  return (
    <div
      className={`glass-card-hover flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${scheme.glow}`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 tracking-wide">
          {title}
        </span>
        {Icon && (
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${scheme.bgIcon} ${scheme.iconText} transition-transform duration-200 group-hover:scale-105`}
          >
            <Icon size={20} />
          </div>
        )}
      </div>

      {/* Main Metric Value */}
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-mono">
          {value}
        </div>
        {badge && (
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${scheme.badgeStyle}`}>
            {badge}
          </span>
        )}
      </div>

      {/* Progress Bar (if provided) */}
      {progress !== null && (
        <div className="my-2 space-y-1">
          <div className="progress-bar-bg h-2">
            <div
              className={`progress-bar-fill ${scheme.bar}`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer Subtext or Trend */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-auto pt-1">
        {subtext && <div className="truncate">{subtext}</div>}
        {trend && (
          <span
            className={`font-semibold shrink-0 ml-2 ${
              trend.positive ? 'text-emerald-500' : 'text-slate-400'
            }`}
          >
            {trend.label}
          </span>
        )}
      </div>
    </div>
  );
}

export default MetricCard;
