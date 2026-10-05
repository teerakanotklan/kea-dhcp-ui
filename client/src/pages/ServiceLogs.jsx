import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Pagination } from '../components/Pagination';
import { SortableTh, EmptyState, EmptyStateRow, TableSkeleton } from '../components/TableParts';
import { usePersistedState } from '../hooks/usePersistedState';
import { useSortableData } from '../hooks/useSortableData';
import {
  Terminal,
  RefreshCw,
  Search,
  Clock,
  Layers,
  Download,
  Copy,
  Check,
  Filter,
  Eye,
  X,
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  RotateCcw
} from 'lucide-react';

const EVENT_CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Event Categories' },
  { value: 'lease', label: 'Lease Events (ALLOC / OFFER / GET)' },
  { value: 'command', label: 'Commands & REST API (config / lease4)' },
  { value: 'hook', label: 'Hooks & Callouts' },
  { value: 'lifecycle', label: 'Lifecycle (STARTING / SHUTDOWN)' },
  { value: 'error', label: 'Errors & Warnings' },
];

export function ServiceLogs({ setNotification }) {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedService, setSelectedService] = usePersistedState('logs.service', 'all');
  const [selectedLevel, setSelectedLevel] = usePersistedState('logs.level', 'all');
  const [selectedCategory, setSelectedCategory] = usePersistedState('logs.category', 'all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = usePersistedState('logs.limit', 100);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = usePersistedState('logs.pageSize', 25);

  // Interaction
  const [copiedId, setCopiedId] = useState(null);

  const handleViewDetail = (log) => {
    try {
      sessionStorage.setItem(`current_log_${log.id}`, JSON.stringify(log));
    } catch (e) {
      // Ignore
    }
    navigate(`/logs/${log.id}`, { state: { log } });
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/service/logs?limit=${limit}&service=${selectedService}`);
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      if (setNotification) setNotification({ type: 'danger', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [selectedService, limit]);

  // Client-side filtering
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Severity Level filter
      if (selectedLevel !== 'all') {
        const logLvl = (log.level || 'INFO').toUpperCase();
        if (selectedLevel === 'ERROR' && !(logLvl === 'ERROR' || logLvl === 'FATAL' || logLvl === 'CRIT')) {
          return false;
        } else if (selectedLevel !== 'ERROR' && logLvl !== selectedLevel) {
          return false;
        }
      }

      // 2. Event Category filter
      if (selectedCategory !== 'all') {
        const fullText = `${log.event || ''} ${log.message || ''}`.toLowerCase();
        if (selectedCategory === 'lease' && !/lease|alloc|offer/i.test(fullText)) {
          return false;
        }
        if (selectedCategory === 'command' && !/command|config-get|config-set|ctrl_agent/i.test(fullText)) {
          return false;
        }
        if (selectedCategory === 'hook' && !/hook|callout|library/i.test(fullText)) {
          return false;
        }
        if (selectedCategory === 'lifecycle' && !/starting|shutdown|started|stopping/i.test(fullText)) {
          return false;
        }
        if (selectedCategory === 'error' && !/error|failed|failure|warn/i.test(fullText)) {
          return false;
        }
      }

      // 3. Free text search
      if (search.trim()) {
        const query = search.toLowerCase();
        const msg = (log.message || '').toLowerCase();
        const evt = (log.event || '').toLowerCase();
        const ts = (log.timestamp || '').toLowerCase();
        const svc = (log.service || '').toLowerCase();
        if (!msg.includes(query) && !evt.includes(query) && !ts.includes(query) && !svc.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [logs, selectedLevel, selectedCategory, search]);

  // Reset to page 1 when filters, search, or limit change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedService, selectedLevel, selectedCategory, search, limit]);

  const sortColumns = useMemo(() => ({
    timestamp: { get: (l) => l.timestamp, type: 'string' },
    service: { get: (l) => l.service, type: 'string' },
    level: { get: (l) => l.level, type: 'string' }
  }), []);
  const { sorted: sortedLogs, sort, toggleSort } = useSortableData(filteredLogs, sortColumns);
  const sortProps = { sort, onSort: toggleSort };

  // Paginated logs slice
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedLogs.slice(start, start + pageSize);
  }, [sortedLogs, currentPage, pageSize]);

  const handleCopy = (log) => {
    const textToCopy = `[${log.timestamp}] [${log.service}] [${log.level}] ${log.event ? `[${log.event}] ` : ''}${log.message}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
    if (setNotification) {
      setNotification({ type: 'success', message: 'Log line copied to clipboard' });
    }
  };

  const handleResetFilters = () => {
    setSelectedService('all');
    setSelectedLevel('all');
    setSelectedCategory('all');
    setSearch('');
  };

  const exportCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['Timestamp', 'Service', 'Level', 'Event Tag', 'Message'];
    const rows = filteredLogs.map((l) => [
      `"${l.timestamp || ''}"`,
      `"${l.service || ''}"`,
      `"${l.level || 'INFO'}"`,
      `"${l.event || ''}"`,
      `"${(l.message || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `kea_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderLevelBadge = (level) => {
    const lvl = (level || 'INFO').toUpperCase();
    switch (lvl) {
      case 'ERROR':
      case 'FATAL':
      case 'CRIT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <AlertCircle size={11} /> {lvl}
          </span>
        );
      case 'WARN':
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertTriangle size={11} /> WARN
          </span>
        );
      case 'DEBUG':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Bug size={11} /> DEBUG
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
            <Info size={11} /> INFO
          </span>
        );
    }
  };

  const renderServiceBadge = (svc) => {
    const name = (svc || '').toLowerCase();
    if (name.includes('dhcp4')) {
      return (
        <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 whitespace-nowrap">
          kea-dhcp4
        </span>
      );
    }
    if (name.includes('ctrl') || name.includes('agent')) {
      return (
        <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
          kea-ctrl-agent
        </span>
      );
    }
    return (
      <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-medium bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 whitespace-nowrap">
        {name || 'system'}
      </span>
    );
  };

  const isFiltering = selectedService !== 'all' || selectedLevel !== 'all' || selectedCategory !== 'all' || Boolean(search);

  return (
    <div className="page-wrapper page-fill">
      {/* Header */}
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Kea Daemon Logs
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Live logs from Kea DHCPv4 Server and Kea Control Agent
          </p>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Showing <strong className="text-slate-800 dark:text-slate-200 font-mono">{filteredLogs.length}</strong> of{' '}
          <strong className="font-mono">{logs.length}</strong> events
        </div>
      </div>

      {/* Single-row toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <input
            type="text"
            className="input-text py-2 pl-9 pr-8 text-xs sm:text-sm w-full"
            placeholder="Search messages, event tags, timestamps, client IPs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select className="select-input text-xs py-2 w-auto" value={selectedService} onChange={(e) => setSelectedService(e.target.value)} title="Service">
          <option value="all">All Kea Daemons</option>
          <option value="dhcp4">Kea DHCPv4 Server</option>
          <option value="ctrl-agent">Kea Control Agent</option>
        </select>

        <select className="select-input text-xs py-2 w-auto" value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)} title="Severity">
          <option value="all">All Levels</option>
          <option value="INFO">INFO</option>
          <option value="WARN">WARN</option>
          <option value="ERROR">ERROR / FATAL</option>
          <option value="DEBUG">DEBUG</option>
        </select>

        <select className="select-input text-xs py-2 w-auto" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} title="Event category">
          {EVENT_CATEGORY_OPTIONS.map((cat) => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>

        <select className="select-input text-xs py-2 w-auto" value={limit} onChange={(e) => setLimit(parseInt(e.target.value, 10))} title="Fetch limit">
          <option value={50}>50 lines</option>
          <option value={100}>100 lines</option>
          <option value={200}>200 lines</option>
          <option value={500}>500 lines</option>
        </select>

        {isFiltering && (
          <button type="button" className="btn btn-secondary text-xs py-2" onClick={handleResetFilters}>
            <RotateCcw size={13} /> Reset
          </button>
        )}

        <button className="btn btn-secondary text-xs py-2" onClick={exportCSV} disabled={filteredLogs.length === 0} title="Export filtered logs to CSV">
          <Download size={14} /> CSV
        </button>
      </div>

      {/* Structured Logs Table (fills remaining height) */}
      <div className="glass-card table-card shadow-sm">
        <div className="table-container">
          <table className={`data-table ${!loading && filteredLogs.length === 0 ? 'is-empty' : ''}`}>
            <thead>
              <tr>
                <th className="text-center w-14">#</th>
                <SortableTh label="Timestamp" sortKey="timestamp" className="w-40" {...sortProps} />
                <SortableTh label="Service" sortKey="service" className="w-32" {...sortProps} />
                <SortableTh label="Level" sortKey="level" className="w-24" {...sortProps} />
                <th className="max-w-xs lg:max-w-sm xl:max-w-lg">Message</th>
                <th className="text-right w-24">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <TableSkeleton rows={8} cols={6} />
              ) : (
                paginatedLogs.map((log, index) => {
                  const isError = (log.level || '').toUpperCase() === 'ERROR';
                  const isWarn = (log.level || '').toUpperCase() === 'WARN';
                  const absoluteIndex = (currentPage - 1) * pageSize + index + 1;

                  return (
                    <tr
                      key={log.id || index}
                      className={`transition-colors cursor-pointer hover:bg-slate-50/80 dark:hover:bg-white/[0.03] ${
                        isError
                          ? 'bg-rose-500/[0.03] dark:bg-rose-500/[0.05]'
                          : isWarn
                          ? 'bg-amber-500/[0.03] dark:bg-amber-500/[0.04]'
                          : ''
                      }`}
                      onClick={() => handleViewDetail(log)}
                    >
                      {/* Index */}
                      <td className="text-center font-mono text-xs text-slate-400 select-none">
                        {absoluteIndex}
                      </td>

                      {/* Timestamp */}
                      <td className="font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {log.timestamp}
                      </td>

                      {/* Service */}
                      <td>
                        {renderServiceBadge(log.service)}
                      </td>

                      {/* Level */}
                      <td>
                        {renderLevelBadge(log.level)}
                      </td>

                      {/* Truncated Message (Ellipsis, no horizontal scroll) */}
                      <td className="font-mono text-xs leading-normal text-slate-700 dark:text-slate-300 truncate max-w-xs lg:max-w-sm xl:max-w-lg">
                        <span className={isError ? 'text-rose-500 font-medium' : isWarn ? 'text-amber-500 font-medium' : ''}>
                          {log.message}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => handleCopy(log)}
                            title="Copy log entry"
                          >
                            {copiedId === log.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => handleViewDetail(log)}
                            title="View Full Details (/logs/:id)"
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}

              {filteredLogs.length === 0 && !loading && (
                <EmptyStateRow
                  colSpan={6}
                  icon={Terminal}
                  title={isFiltering ? 'No logs match the current filter criteria' : 'No log entries available'}
                  hint={isFiltering ? 'Try changing the service, severity level, category, or search text.' : 'System logs generated by Kea daemons will appear here.'}
                  actions={
                    isFiltering && (
                      <button type="button" className="btn btn-secondary text-xs" onClick={handleResetFilters}>
                        <RotateCcw size={13} /> Reset Filters
                      </button>
                    )
                  }
                />
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredLogs.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[15, 25, 50, 100]}
        />
      </div>
    </div>
  );
}
