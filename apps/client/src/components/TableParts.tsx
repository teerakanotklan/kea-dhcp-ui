import React, { ReactNode, ComponentType, useState } from 'react';
import { ArrowUp, ArrowDown, ChevronsUpDown, Copy, Check, LucideProps } from 'lucide-react';
import { SortState } from '../hooks/useSortableData';

import { NotificationState } from '@kea/shared';
export type { NotificationState };

export interface SortableThProps {
  label: ReactNode;
  sortKey: string;
  sort: SortState | null;
  onSort: (key: string) => void;
  className?: string;
}

// Clickable, sortable <th> with responsive styling
export function SortableTh({ label, sortKey, sort, onSort, className = '' }: SortableThProps) {
  const active = sort && sort.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className={`sortable ${className}`} onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1.5 group select-none">
        {label}
        <Icon
          size={13}
          className={`transition-colors duration-150 ${
            active
              ? 'text-indigo-600 dark:text-indigo-400 opacity-100 scale-110'
              : 'opacity-30 group-hover:opacity-75'
          }`}
        />
      </span>
    </th>
  );
}

// Skeleton rows shown while table data loads with modern shimmer
export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={`sk-${r}`} className="animate-pulse">
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} className="py-4">
              <div
                className="skeleton-bar"
                style={{
                  width: `${Math.min(90, Math.max(35, 50 + ((r * 11 + c * 17) % 45)))}%`,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export interface EmptyStateProps {
  icon?: ComponentType<LucideProps>;
  title: string;
  hint?: string;
  actions?: ReactNode;
}

// Modern Empty-state row content with glowing backdrop
export function EmptyState({ icon: Icon, title, hint, actions }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-4 h-full min-h-[260px] text-center text-slate-500 dark:text-slate-400">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 dark:text-slate-500 shadow-sm mb-1">
          <Icon size={28} />
        </div>
      )}
      <div className="max-w-md">
        <h4 className="font-bold text-base text-slate-800 dark:text-slate-200">{title}</h4>
        {hint && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{hint}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 mt-2">{actions}</div>}
    </div>
  );
}

export interface EmptyStateRowProps extends EmptyStateProps {
  colSpan: number;
}

// Full-height empty-state row for tables
export function EmptyStateRow({ colSpan, icon, title, hint, actions }: EmptyStateRowProps) {
  return (
    <tr className="empty-state-row h-full">
      <td colSpan={colSpan} className="h-full p-0 text-center">
        <EmptyState icon={icon} title={title} hint={hint} actions={actions} />
      </td>
    </tr>
  );
}

export interface CopyTextProps {
  value?: string | null;
  setNotification?: (notif: NotificationState) => void;
  className?: string;
  children?: ReactNode;
}

// Click-to-copy button for IP / MAC / Subnet with animated checkmark
export function CopyText({ value, setNotification, className = '', children }: CopyTextProps) {
  const [copied, setCopied] = useState(false);

  if (!value) return <span className={className}>{children ?? '—'}</span>;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (setNotification) {
      setNotification({ type: 'success', message: `Copied: ${value}` });
    }
  };

  return (
    <button
      type="button"
      title="Click to copy to clipboard"
      className={`group inline-flex items-center gap-1.5 text-left font-mono hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-copy ${className}`}
      onClick={handleCopy}
    >
      <span>{children ?? value}</span>
      <span className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-200/60 dark:hover:bg-white/10">
        {copied ? (
          <Check size={12} className="text-emerald-500 shrink-0" />
        ) : (
          <Copy size={12} className="text-slate-400 dark:text-slate-500 shrink-0" />
        )}
      </span>
    </button>
  );
}
