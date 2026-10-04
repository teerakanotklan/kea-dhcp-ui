import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Pagination } from '../components/Pagination';
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
  const [selectedService, setSelectedService] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(100);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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
  }, [selectedService, limit]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedService, limit]);

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

  // Paginated logs slice
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

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
    <div className="page-wrapper max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Kea Daemon Logs
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Live transaction logs and telemetry generated by Kea DHCPv4 Server and Kea Control Agent
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            className={`btn text-xs sm:text-sm ${
              autoRefresh ? 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-sm shadow-cyan-500/25' : 'btn-secondary'
            }`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title="Auto-refresh logs every 5 seconds"
          >
            <Clock size={15} />
            {autoRefresh ? 'Auto (5s): ON' : 'Auto-Poll'}
          </button>

          <button
            className="btn btn-secondary text-xs sm:text-sm"
            onClick={exportCSV}
            disabled={filteredLogs.length === 0}
            title="Export filtered logs to CSV"
          >
            <Download size={15} />
            Export CSV
          </button>

          <button
            className="btn btn-secondary text-xs sm:text-sm"
            onClick={fetchLogs}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Toolbar (Dropdowns & Search Bar) */}
      <div className="glass-card p-4 sm:p-5 space-y-3.5 border border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-200/80 dark:border-white/10">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <Filter size={15} className="text-indigo-500" />
            <span>Filter Controls</span>
            {isFiltering && (
              <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                Active Filters
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Showing <strong className="text-slate-800 dark:text-slate-200 font-mono">{filteredLogs.length}</strong> of <strong className="font-mono">{logs.length}</strong> events</span>
            {isFiltering && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold ml-2"
                onClick={handleResetFilters}
              >
                <RotateCcw size={12} /> Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Dropdowns Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Service Filter Dropdown */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Service
            </label>
            <select
              className="select-input text-xs py-2 w-full"
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
            >
              <option value="all">All Kea Daemons</option>
              <option value="dhcp4">Kea DHCPv4 Server</option>
              <option value="ctrl-agent">Kea Control Agent</option>
            </select>
          </div>

          {/* 2. Severity Level Dropdown */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Severity Level
            </label>
            <select
              className="select-input text-xs py-2 w-full"
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
            >
              <option value="all">All Severity Levels</option>
              <option value="INFO">INFO (Normal)</option>
              <option value="WARN">WARN (Warning)</option>
              <option value="ERROR">ERROR / FATAL</option>
              <option value="DEBUG">DEBUG</option>
            </select>
          </div>

          {/* 3. Event / Message Category Dropdown */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Event Category
            </label>
            <select
              className="select-input text-xs py-2 w-full"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {EVENT_CATEGORY_OPTIONS.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Query Limit Dropdown */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Fetch Limit (Lines)
            </label>
            <select
              className="select-input text-xs py-2 w-full"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value, 10))}
            >
              <option value={50}>50 Entries</option>
              <option value={100}>100 Entries</option>
              <option value={200}>200 Entries</option>
              <option value={500}>500 Entries</option>
            </select>
          </div>
        </div>

        {/* Free text search bar */}
        <div className="relative w-full">
          <input
            type="text"
            className="input-text py-2 pl-9 pr-8 text-xs sm:text-sm w-full"
            placeholder="Search keyword across messages, event tags, timestamps, or client IPs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Structured Logs Table */}
      <div className="glass-card p-0 overflow-hidden shadow-sm border border-slate-200 dark:border-white/10">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-center w-14">#</th>
                <th className="w-44">Timestamp</th>
                <th className="w-32">Service</th>
                <th className="w-24">Level</th>
                <th>Event Tag</th>
                <th className="text-right w-24">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.map((log, index) => {
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

                    {/* Event Tag */}
                    <td>
                      <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                        {log.event || 'LOG'}
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
              })}

              {filteredLogs.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center gap-2.5">
                      <Terminal size={36} className="text-slate-400 opacity-60" />
                      <span className="font-semibold text-sm">
                        {isFiltering ? 'No logs match the current filter criteria' : 'No log entries available'}
                      </span>
                      {isFiltering && (
                        <button
                          type="button"
                          className="btn btn-secondary text-xs mt-1"
                          onClick={handleResetFilters}
                        >
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
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
