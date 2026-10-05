import React, { ReactNode, ComponentType } from 'react';
import { ArrowUp, ArrowDown, ChevronsUpDown, LucideProps } from 'lucide-react';
import { SortState } from '../hooks/useSortableData';

import { NotificationState } from '@shared';
export type { NotificationState };

export interface SortableThProps {
  label: ReactNode;
  sortKey: string;
  sort: SortState | null;
  onSort: (key: string) => void;
  className?: string;
}

// Clickable, sortable <th>
export function SortableTh({ label, sortKey, sort, onSort, className = '' }: SortableThProps) {
  const active = sort && sort.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className={`sortable ${className}`} onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1.5">
        {label}
        <Icon size={12} className={active ? 'text-indigo-500' : 'opacity-40'} />
      </span>
    </th>
  );
}

// Skeleton rows shown while table data loads
export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={`sk-${r}`}>
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c}>
              <div className="skeleton-bar" style={{ width: `${55 + ((r * 7 + c * 13) % 40)}%` }} />
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

// Empty-state row content
export function EmptyState({ icon: Icon, title, hint, actions }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 py-16 h-full min-h-[250px] text-slate-500 dark:text-slate-400">
      {Icon && <Icon size={36} className="opacity-50" />}
      <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">{title}</span>
      {hint && <span className="text-xs">{hint}</span>}
      {actions && <div className="flex items-center gap-2 mt-1">{actions}</div>}
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

// Click-to-copy text (IP / MAC) with toast
export function CopyText({ value, setNotification, className = '', children }: CopyTextProps) {
  if (!value) return <span className={className}>{children ?? 'N/A'}</span>;
  return (
    <button
      type="button"
      title="Click to copy"
      className={`text-left hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-copy ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        if (setNotification) setNotification({ type: 'success', message: `Copied ${value}` });
      }}
    >
      {children ?? value}
    </button>
  );
}
