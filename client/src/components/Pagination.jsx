import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';

export function Pagination({
  currentPage = 1,
  totalItems = 0,
  pageSize = 25,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100]
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  // Generate visible page numbers with smart ellipsis
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  if (totalItems === 0) return null;

  return (
    <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/80">
      {/* Range and page size */}
      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
        <span>
          Showing <strong className="text-slate-800 dark:text-slate-200 font-mono">{startItem}</strong> to{' '}
          <strong className="text-slate-800 dark:text-slate-200 font-mono">{endItem}</strong> of{' '}
          <strong className="text-slate-800 dark:text-slate-200 font-mono">{totalItems}</strong> entries
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2">
            <span>Show:</span>
            <select
              className="select-input py-1 px-2 text-xs w-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/15 rounded"
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / page
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Page navigation buttons */}
      <div className="flex items-center gap-1 self-center sm:self-auto">
        <button
          className="btn-icon p-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          title="First Page"
        >
          <ChevronsLeft size={14} />
        </button>
        <button
          className="btn-icon p-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          title="Previous Page"
        >
          <ChevronLeft size={14} />
        </button>

        {getPageNumbers().map((p, idx) =>
          p === '...' ? (
            <span key={`ellipsis-${idx}`} className="px-1 text-xs text-slate-400 select-none">
              …
            </span>
          ) : (
            <button
              key={p}
              className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${
                currentPage === p
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/10'
              }`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}

        <button
          className="btn-icon p-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          title="Next Page"
        >
          <ChevronRight size={14} />
        </button>
        <button
          className="btn-icon p-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          title="Last Page"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
}
