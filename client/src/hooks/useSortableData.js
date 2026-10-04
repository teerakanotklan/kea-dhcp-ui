import { useState, useMemo } from 'react';

const ipToNum = (ip) =>
  String(ip || '')
    .split('.')
    .reduce((acc, o) => acc * 256 + (parseInt(o, 10) || 0), 0);

// Generic comparator; `type` may be 'ip' | 'date' | 'string' | 'number'
const compare = (a, b, type) => {
  if (type === 'ip') return ipToNum(a) - ipToNum(b);
  if (type === 'date') return (new Date(a).getTime() || 0) - (new Date(b).getTime() || 0);
  if (type === 'number') return (Number(a) || 0) - (Number(b) || 0);
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' });
};

// columns: { key: { get: (row) => value, type } }
export function useSortableData(rows, columns, initial = null) {
  const [sort, setSort] = useState(initial); // { key, dir: 'asc'|'desc' } | null

  const sorted = useMemo(() => {
    if (!sort || !columns[sort.key]) return rows;
    const { get, type } = columns[sort.key];
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => factor * compare(get(a), get(b), type));
  }, [rows, sort, columns]);

  // Cycle: none -> asc -> desc -> none
  const toggleSort = (key) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  };

  return { sorted, sort, toggleSort };
}
