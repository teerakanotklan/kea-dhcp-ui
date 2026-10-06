import React, { useState } from 'react';
import { X, GitCompare, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw, Loader2 } from 'lucide-react';
import { ClusterNode, ClusterDiffResult } from '@shared';

export interface ClusterDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: ClusterNode | null;
  diffResult: ClusterDiffResult | null;
  loading: boolean;
  onRefreshDiff: () => Promise<void>;
  onPushSync: () => Promise<void>;
}

export function ClusterDiffModal({
  isOpen,
  onClose,
  node,
  diffResult,
  loading,
  onRefreshDiff,
  onPushSync
}: ClusterDiffModalProps) {
  const [syncing, setSyncing] = useState(false);

  if (!isOpen || !node) return null;

  const handleSync = async () => {
    setSyncing(true);
    try {
      await onPushSync();
      await onRefreshDiff();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <GitCompare size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Configuration Diff: {node.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Comparing Local Node configuration with remote node ({node.host})
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

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 size={32} className="animate-spin text-cyan-500 mb-3" />
              <span className="text-xs font-medium">Fetching remote configuration and calculating diff...</span>
            </div>
          ) : !diffResult ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              Unable to load diff comparison.
            </div>
          ) : (
            <>
              {/* Checksum Compare Card */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/40">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Local Checksum
                  </span>
                  <span className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate block mt-0.5" title={diffResult.localChecksum}>
                    {diffResult.localChecksum.substring(0, 16)}...
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Remote Checksum
                  </span>
                  <span className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate block mt-0.5" title={diffResult.remoteChecksum}>
                    {diffResult.remoteChecksum ? `${diffResult.remoteChecksum.substring(0, 16)}...` : 'Unknown'}
                  </span>
                </div>
              </div>

              {/* Status Banner */}
              {diffResult.inSync ? (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-center gap-3">
                  <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                  <div>
                    <h4 className="text-sm font-semibold">Perfect Synchronization</h4>
                    <p className="text-xs opacity-90 mt-0.5">
                      The configuration on {node.name} exactly matches the local server. No drift detected.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 flex items-center gap-3">
                  <AlertTriangle size={20} className="text-amber-500 shrink-0" />
                  <div>
                    <h4 className="text-sm font-semibold">Configuration Drift Detected</h4>
                    <p className="text-xs opacity-90 mt-0.5">
                      Found {diffResult.differences.length} difference(s) between local and remote server.
                    </p>
                  </div>
                </div>
              )}

              {/* Differences List */}
              {diffResult.differences.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Difference Details ({diffResult.differences.length})
                  </h4>
                  <div className="space-y-2">
                    {diffResult.differences.map((diff, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/80 text-xs"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {diff.type.toUpperCase()}: {diff.key}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${
                              diff.difference === 'missing_in_remote'
                                ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300'
                                : diff.difference === 'missing_in_local'
                                ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'
                                : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {diff.difference.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                          <div className="truncate">
                            <span className="font-medium text-slate-700 dark:text-slate-300">Local: </span>
                            <span className="font-mono">{diff.localValue}</span>
                          </div>
                          <div className="truncate">
                            <span className="font-medium text-slate-700 dark:text-slate-300">Remote: </span>
                            <span className="font-mono">{diff.remoteValue}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
          <button
            type="button"
            disabled={loading}
            onClick={onRefreshDiff}
            className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh Diff
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              disabled={syncing || loading}
              onClick={handleSync}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {syncing ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Pushing...
                </>
              ) : (
                <>
                  Push Local Config to Host
                  <ArrowRight size={13} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
