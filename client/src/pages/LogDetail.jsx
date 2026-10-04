import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Terminal,
  Copy,
  Check,
  Clock,
  Layers,
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  FileText,
  Hash,
  Share2
} from 'lucide-react';

export function LogDetail({ setNotification }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [log, setLog] = useState(() => {
    // 1. Try React Router state
    if (location.state && location.state.log) {
      return location.state.log;
    }
    // 2. Try sessionStorage fallback for direct refresh
    try {
      const cached = sessionStorage.getItem(`current_log_${id}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      // Ignore sessionStorage parsing error
    }
    return null;
  });

  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  useEffect(() => {
    if (log && id) {
      try {
        sessionStorage.setItem(`current_log_${id}`, JSON.stringify(log));
      } catch (e) {
        // Ignore
      }
    }
  }, [log, id]);

  const copyToClipboard = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'raw') {
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    } else {
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2000);
    }
    if (setNotification) {
      setNotification({
        type: 'success',
        message: `${type === 'raw' ? 'Raw log' : 'Message'} copied to clipboard`
      });
    }
  };

  const renderServiceBadge = (service) => {
    const s = (service || '').toLowerCase();
    if (s.includes('dhcp4')) {
      return (
        <span className="badge border border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-semibold px-2 py-0.5 rounded text-xs">
          kea-dhcp4
        </span>
      );
    }
    if (s.includes('ctrl') || s.includes('agent')) {
      return (
        <span className="badge border border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-400 font-semibold px-2 py-0.5 rounded text-xs">
          ctrl-agent
        </span>
      );
    }
    if (s.includes('dhcp6')) {
      return (
        <span className="badge border border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400 font-semibold px-2 py-0.5 rounded text-xs">
          kea-dhcp6
        </span>
      );
    }
    return (
      <span className="badge border border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-400 font-semibold px-2 py-0.5 rounded text-xs">
        {service || 'kea'}
      </span>
    );
  };

  const renderLevelBadge = (level) => {
    const lvl = (level || 'INFO').toUpperCase();
    switch (lvl) {
      case 'ERROR':
      case 'FATAL':
      case 'CRIT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold border border-rose-500/30 bg-rose-500/15 text-rose-600 dark:text-rose-400">
            <AlertCircle size={13} />
            {lvl}
          </span>
        );
      case 'WARN':
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold border border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <AlertTriangle size={13} />
            {lvl}
          </span>
        );
      case 'DEBUG':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold border border-slate-500/30 bg-slate-500/15 text-slate-600 dark:text-slate-400">
            <Bug size={13} />
            {lvl}
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold border border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <Info size={13} />
            {lvl}
          </span>
        );
    }
  };

  if (!log) {
    return (
      <div className="page-wrapper max-w-6xl mx-auto py-8 px-4 sm:px-8 space-y-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn btn-secondary flex items-center gap-2 text-xs sm:text-sm py-2 px-3"
            onClick={() => navigate('/logs')}
          >
            <ArrowLeft size={16} />
            Back to Logs
          </button>
        </div>

        <div className="glass-card p-12 text-center space-y-4">
          <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 text-amber-500">
            <AlertTriangle size={36} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Log Entry Not Cached
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Log entry #{id} is not present in local session memory. Live system logs rotate frequently. Please return to the Logs table to inspect recent logs.
          </p>
          <div className="pt-2">
            <button
              type="button"
              className="btn btn-primary text-xs sm:text-sm"
              onClick={() => navigate('/logs')}
            >
              Return to Logs Table
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isError = (log.level || '').toUpperCase() === 'ERROR';
  const isWarn = (log.level || '').toUpperCase() === 'WARN';

  return (
    <div className="page-wrapper max-w-6xl mx-auto py-8 px-4 sm:px-8 space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn btn-secondary flex items-center gap-2 text-xs sm:text-sm py-2 px-3"
            onClick={() => navigate('/logs')}
          >
            <ArrowLeft size={16} />
            Back to Logs
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Terminal size={22} className="text-indigo-500" />
              Log Entry #{log.id || id}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Detailed inspection of Kea DHCP syslog journal entry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary text-xs sm:text-sm flex items-center gap-2"
            onClick={() => copyToClipboard(log.raw || log.message, 'raw')}
          >
            {copiedRaw ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            Copy Raw
          </button>
        </div>
      </div>

      {/* Meta Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4 space-y-1.5 border border-slate-200 dark:border-white/10">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Service
          </span>
          <div className="pt-0.5">{renderServiceBadge(log.service)}</div>
        </div>

        <div className="glass-card p-4 space-y-1.5 border border-slate-200 dark:border-white/10">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Severity
          </span>
          <div className="pt-0.5">{renderLevelBadge(log.level)}</div>
        </div>

        <div className="glass-card p-4 space-y-1.5 border border-slate-200 dark:border-white/10">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Event Tag
          </span>
          <span className="inline-block font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200">
            {log.event || 'LOG'}
          </span>
        </div>

        <div className="glass-card p-4 space-y-1.5 border border-slate-200 dark:border-white/10">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Timestamp
          </span>
          <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Clock size={13} className="text-slate-400 shrink-0" />
            <span className="truncate">{log.timestamp}</span>
          </div>
        </div>
      </div>

      {/* Decoded Message Card */}
      <div className="glass-card p-5 space-y-3 border border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-indigo-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">
              Decoded Message
            </h2>
          </div>
          <button
            type="button"
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            onClick={() => copyToClipboard(log.message, 'msg')}
          >
            {copiedMsg ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            Copy Message
          </button>
        </div>

        <div
          className={`p-4 rounded-xl font-mono text-xs sm:text-sm leading-relaxed break-words select-text border ${
            isError
              ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/40'
              : isWarn
              ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/40'
              : 'bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-white/10'
          }`}
        >
          {log.message}
        </div>
      </div>

      {/* Raw Syslog Record Card */}
      <div className="glass-card p-5 space-y-3 border border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-slate-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">
              Raw Syslog Record
            </h2>
          </div>
          <button
            type="button"
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            onClick={() => copyToClipboard(log.raw || log.message, 'raw')}
          >
            {copiedRaw ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            Copy Raw
          </button>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 text-slate-300 font-mono text-xs leading-relaxed break-all select-text border border-white/5 shadow-inner">
          <div className="text-slate-500 text-[11px] mb-2 border-b border-white/10 pb-1 select-none">
            # journalctl / systemd-journald raw entry:
          </div>
          {log.raw || log.message}
        </div>
      </div>

      {/* Metadata Overview Card */}
      <div className="glass-card p-5 space-y-3 border border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-2">
          <Hash size={16} className="text-slate-400" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">
            Record Metadata
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-xs divide-y sm:divide-y-0 divide-slate-100 dark:divide-white/5">
          <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
            <span className="text-slate-500 dark:text-slate-400">Log ID</span>
            <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{log.id || id}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
            <span className="text-slate-500 dark:text-slate-400">Daemon</span>
            <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{log.service || 'kea'}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
            <span className="text-slate-500 dark:text-slate-400">Severity Level</span>
            <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{log.level || 'INFO'}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
            <span className="text-slate-500 dark:text-slate-400">Event Tag</span>
            <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{log.event || 'None'}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500 dark:text-slate-400">Timestamp</span>
            <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{log.timestamp}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500 dark:text-slate-400">Message Length</span>
            <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
              {(log.message || '').length} characters
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
