import React, { useState, useEffect } from 'react';
import { X, Server, CheckCircle2, AlertCircle, Loader2, Network } from 'lucide-react';
import { ClusterNode, NodeRole } from '@shared';

export interface ClusterHostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (node: Partial<ClusterNode>) => Promise<void>;
  node?: ClusterNode | null;
  onTestConnection: (node: Partial<ClusterNode>) => Promise<{
    success: boolean;
    latencyMs?: number;
    uiReachable?: boolean;
    agentReachable?: boolean;
    message: string;
  }>;
}

export function ClusterHostModal({
  isOpen,
  onClose,
  onSave,
  node,
  onTestConnection
}: ClusterHostModalProps) {
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [uiPort, setUiPort] = useState(3000);
  const [agentUrl, setAgentUrl] = useState('');
  const [role, setRole] = useState<NodeRole>('secondary');
  const [isLocal, setIsLocal] = useState(false);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs?: number;
    uiReachable?: boolean;
    agentReachable?: boolean;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (node) {
      setName(node.name || '');
      setHost(node.host || '');
      setUiPort(node.uiPort || 3000);
      setAgentUrl(node.agentUrl || '');
      setRole(node.role || 'secondary');
      setIsLocal(Boolean(node.isLocal));
    } else {
      setName('');
      setHost('');
      setUiPort(3000);
      setAgentUrl('');
      setRole('secondary');
      setIsLocal(false);
    }
    setTestResult(null);
    setError(null);
  }, [node, isOpen]);

  if (!isOpen) return null;

  const handleTest = async () => {
    if (!host.trim()) {
      setError('Please enter host IP or domain first');
      return;
    }
    setTesting(true);
    setError(null);
    try {
      const res = await onTestConnection({
        host: host.trim(),
        uiPort,
        agentUrl: agentUrl.trim() || `http://${host.trim()}:8000`
      });
      setTestResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection test failed';
      setTestResult({
        success: false,
        message: msg
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Host name is required');
      return;
    }
    if (!host.trim()) {
      setError('Host IP or domain is required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        host: host.trim(),
        uiPort: Number(uiPort),
        agentUrl: agentUrl.trim() || `http://${host.trim()}:8000`,
        role,
        isLocal
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save host';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <Server size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {node ? 'Edit Cluster Host' : 'Add Cluster Host'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure cluster server node and communication endpoints
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
          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {error && (
              <div className="p-3 text-sm rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Host / Node Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. kea-master-01 or Secondary-Node"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Host IP / FQDN *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 192.168.153.9"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Web UI Port
                </label>
                <input
                  type="number"
                  min="1"
                  max="65535"
                  value={uiPort}
                  onChange={(e) => setUiPort(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Kea Control Agent URL
              </label>
              <input
                type="text"
                placeholder={host ? `http://${host}:8000` : 'http://192.168.153.9:8000'}
                value={agentUrl}
                onChange={(e) => setAgentUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-mono"
              />
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                Leave empty to auto-derive from Host IP with port 8000
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Cluster Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as NodeRole)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                >
                  <option value="primary">Primary (Active)</option>
                  <option value="secondary">Secondary (Standby / Peer)</option>
                  <option value="backup">Backup (Observer)</option>
                </select>
              </div>

              <div className="flex flex-col justify-end pb-1.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isLocal}
                    onChange={(e) => setIsLocal(e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                  />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    This is Current / Local Server
                  </span>
                </label>
              </div>
            </div>

            {/* Test Connection Button & Result */}
            <div className="pt-2">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Connectivity Check
                </span>
                <button
                  type="button"
                  disabled={testing || !host.trim()}
                  onClick={handleTest}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {testing ? (
                    <>
                      <Loader2 size={13} className="animate-spin text-cyan-500" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Network size={13} />
                      Test Connection
                    </>
                  )}
                </button>
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
                    testResult.success
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-500 mt-0.5" />
                  ) : (
                    <AlertCircle size={16} className="shrink-0 text-rose-500 mt-0.5" />
                  )}
                  <div>
                    <div className="font-semibold">{testResult.message}</div>
                    {testResult.latencyMs !== undefined && (
                      <div className="opacity-80 mt-0.5">
                        Latency: {testResult.latencyMs}ms | UI API: {testResult.uiReachable ? 'OK' : 'Failed'} | Kea Agent: {testResult.agentReachable ? 'OK' : 'Failed'}
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                'Save Host'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
