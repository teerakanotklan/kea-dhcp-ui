import { useState, useMemo } from 'react';

export type SortType = 'ip' | 'date' | 'string' | 'number';

export interface ColumnSortConfig<T> {
  get: (row: T) => unknown;
  type: SortType;
}

export type ColumnsConfig<T> = Record<string, ColumnSortConfig<T>>;

export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

const ipToNum = (ip: unknown): number =>
  String(ip || '')
    .split('.')
    .reduce((acc, o) => acc * 256 + (parseInt(o, 10) || 0), 0);

// Generic comparator; `type` may be 'ip' | 'date' | 'string' | 'number'
const compare = (a: unknown, b: unknown, type: SortType): number => {
  if (type === 'ip') return ipToNum(a) - ipToNum(b);
  if (type === 'date') return (new Date(String(a)).getTime() || 0) - (new Date(String(b)).getTime() || 0);
  if (type === 'number') return (Number(a) || 0) - (Number(b) || 0);
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' });
};

// columns: { key: { get: (row) => value, type } }
export function useSortableData<T>(
  rows: T[],
  columns: ColumnsConfig<T>,
  initial: SortState | null = null
) {
  const [sort, setSort] = useState<SortState | null>(initial);

  const sorted = useMemo(() => {
    if (!sort || !columns[sort.key]) return rows;
    const { get, type } = columns[sort.key];
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => factor * compare(get(a), get(b), type));
  }, [rows, sort, columns]);

  // Cycle: none -> asc -> desc -> none
  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  };

  return { sorted, sort, toggleSort };
}
