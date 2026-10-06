import React, { useState, useEffect } from 'react';
import { X, Settings2, KeyRound, RefreshCw, Copy, Check, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { ClusterSettings, ClusterMode } from '@shared';

export interface ClusterSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ClusterSettings | null;
  onSave: (settings: Partial<ClusterSettings>) => Promise<void>;
}

export function ClusterSettingsModal({
  isOpen,
  onClose,
  settings,
  onSave
}: ClusterSettingsModalProps) {
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<ClusterMode>('failover');
  const [thisServerName, setThisServerName] = useState('node-primary');
  const [clusterSecret, setClusterSecret] = useState('');
  const [autoSyncOnSave, setAutoSyncOnSave] = useState(true);
  const [periodicSyncIntervalSec, setPeriodicSyncIntervalSec] = useState(60);
  const [heartbeatDelayMs, setHeartbeatDelayMs] = useState(10000);
  const [maxResponseDelayMs, setMaxResponseDelayMs] = useState(60000);
  const [maxAckDelayMs, setMaxAckDelayMs] = useState(5000);
  const [autoFailover, setAutoFailover] = useState(true);
  const [haHookLibPath, setHaHookLibPath] = useState('');

  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setEnabled(Boolean(settings.enabled));
      setMode(settings.mode || 'failover');
      setThisServerName(settings.thisServerName || 'node-primary');
      setClusterSecret(settings.clusterSecret || '');
      setAutoSyncOnSave(Boolean(settings.autoSyncOnSave));
      setPeriodicSyncIntervalSec(settings.periodicSyncIntervalSec ?? 60);
      setHeartbeatDelayMs(settings.heartbeatDelayMs ?? 10000);
      setMaxResponseDelayMs(settings.maxResponseDelayMs ?? 60000);
      setMaxAckDelayMs(settings.maxAckDelayMs ?? 5000);
      setAutoFailover(settings.autoFailover !== false);
      setHaHookLibPath(settings.haHookLibPath || '');
    }
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const generateSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let res = '';
    for (let i = 0; i < 32; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setClusterSecret(res);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(clusterSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clusterSecret.length < 8) {
      setError('Cluster secret must be at least 8 characters');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        enabled,
        mode,
        thisServerName: thisServerName.trim() || 'node-primary',
        clusterSecret,
        autoSyncOnSave,
        periodicSyncIntervalSec: Number(periodicSyncIntervalSec),
        heartbeatDelayMs: Number(heartbeatDelayMs),
        maxResponseDelayMs: Number(maxResponseDelayMs),
        maxAckDelayMs: Number(maxAckDelayMs),
        autoFailover,
        haHookLibPath: haHookLibPath.trim() || undefined
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save cluster settings';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Settings2 size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Cluster & High Availability Settings
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure Failover, Load Balancing mode, and Auto-sync policy
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            {error && (
              <div className="p-3 text-sm rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Enable Cluster Toggle */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white block">
                  Enable High Availability Cluster
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Activates Kea HA Hook library and real-time lease replication between nodes
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            {/* Mode Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Cluster High Availability Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setMode('failover')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    mode === 'failover'
                      ? 'border-cyan-500 bg-cyan-50/30 dark:bg-cyan-500/10 ring-2 ring-cyan-500/20'
                      : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      Failover (Hot Standby)
                    </span>
                    {mode === 'failover' && <ShieldCheck size={16} className="text-cyan-500" />}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Primary handles all traffic; Secondary takes over automatically if Primary is down.
                  </p>
                </div>

                <div
                  onClick={() => setMode('load-balancing')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    mode === 'load-balancing'
                      ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-500/10 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      Load Balancing
                    </span>
                    {mode === 'load-balancing' && <ShieldCheck size={16} className="text-indigo-500" />}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Active-Active: Both servers serve 50/50 requests and act as full backup for each other.
                  </p>
                </div>
              </div>
            </div>

            {/* Cluster Shared Secret */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound size={13} className="text-amber-500" />
                  Cluster Shared Secret (Inter-node Token)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={generateSecret}
                    className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw size={11} /> Generate
                  </button>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-1"
                  >
                    {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <input
                type="text"
                required
                value={clusterSecret}
                onChange={(e) => setClusterSecret(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-mono"
              />
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                All nodes in the cluster must share this secret key for secure configuration synchronization.
              </span>
            </div>

            {/* Sync Policy Options */}
            <div className="space-y-3 pt-1">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSyncOnSave}
                  onChange={(e) => setAutoSyncOnSave(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                    Auto-Sync Configuration on Changes
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Automatically push new scopes, static reservations, and settings to all cluster peers when saved
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoFailover}
                  onChange={(e) => setAutoFailover(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                    Kea DHCP Auto-Failover
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Allow Kea to automatically transition peer state to partner-down if heartbeat fails
                  </span>
                </div>
              </label>
            </div>

            {/* Advanced Timers */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Heartbeat Delay (ms)
                </label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  value={heartbeatDelayMs}
                  onChange={(e) => setHeartbeatDelayMs(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Max Response Delay (ms)
                </label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  value={maxResponseDelayMs}
                  onChange={(e) => setMaxResponseDelayMs(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-mono"
                />
              </div>
            </div>

            {/* Hook Library Path Override */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Kea HA Hook Library Path (`libdhcp_ha.so`)
              </label>
              <input
                type="text"
                placeholder="/usr/lib/x86_64-linux-gnu/kea/hooks/libdhcp_ha.so"
                value={haHookLibPath}
                onChange={(e) => setHaHookLibPath(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-mono"
              />
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                Leave empty for automatic OS distribution detection
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50/50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
