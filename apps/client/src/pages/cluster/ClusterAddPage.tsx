import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  ArrowLeft,
  Server,
  Shield,
  Layers,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Network,
  Copy,
  Check,
  Eye,
  EyeOff,
  Radio,
  Info,
  Activity,
} from "lucide-react";
import {
  ClusterMode,
  NodeRole,
  NotificationState,
  ClusterSettings,
} from '@kea/shared';

export interface ClusterAddPageProps {
  setNotification?: (notif: NotificationState) => void;
}

export function ClusterAddPage({ setNotification }: ClusterAddPageProps) {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();

  // Form State
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [uiPort, setUiPort] = useState(3000);
  const [agentUrl, setAgentUrl] = useState("");
  const [role, setRole] = useState<NodeRole>("secondary");
  const [clusterMode, setClusterMode] = useState<ClusterMode>("failover");
  const [enableHa, setEnableHa] = useState(true);
  const [autoFailover, setAutoFailover] = useState(true);

  // Authentication & Pairing
  const [clusterSecret, setClusterSecret] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  // Connection Test State
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs?: number;
    uiReachable?: boolean;
    agentReachable?: boolean;
    message: string;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current cluster settings to populate clusterSecret and default mode
  useEffect(() => {
    let isMounted = true;
    async function loadSettings() {
      try {
        const res = await apiFetch("/api/cluster/settings");
        if (res.ok) {
          const data: ClusterSettings = await res.json();
          if (isMounted) {
            if (data.clusterSecret) setClusterSecret(data.clusterSecret);
            if (data.mode) setClusterMode(data.mode);
            if (data.autoFailover !== undefined)
              setAutoFailover(data.autoFailover);
          }
        }
      } catch {
        // fallback
      }
    }
    loadSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-populate Kea Agent URL when host changes
  const handleHostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHost(val);
    if (!agentUrl || agentUrl.startsWith("http://")) {
      if (val.trim()) {
        setAgentUrl(`http://${val.trim()}:8000`);
      }
    }
  };

  const handleCopySecret = () => {
    if (!clusterSecret) return;
    navigator.clipboard.writeText(clusterSecret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const handleTestConnection = async () => {
    if (!host.trim()) {
      setError("Please specify Host IP or Domain before testing connection");
      return;
    }
    setTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const res = await apiFetch("/api/cluster/nodes/test-temp", {
        method: "POST",
        body: JSON.stringify({
          host: host.trim(),
          uiPort: Number(uiPort),
          agentUrl: agentUrl.trim() || `http://${host.trim()}:8000`,
        }),
      });

      const data = await res.json();
      setTestResult(data);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Connection test request failed";
      setTestResult({
        success: false,
        message: msg,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter Node Name");
      return;
    }
    if (!host.trim()) {
      setError("Please enter Host IP Address or Domain");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        host: host.trim(),
        uiPort: Number(uiPort),
        agentUrl: agentUrl.trim() || `http://${host.trim()}:8000`,
        role,
        isLocal: false,
        adminPassword: adminPassword.trim() || undefined,
        enableHa,
        clusterMode,
        clusterSecret: clusterSecret.trim() || undefined,
      };

      const res = await apiFetch("/api/cluster/nodes", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add cluster node");
      }

      if (setNotification) {
        setNotification({
          type: "success",
          message: `Added node '${name}' to cluster and initialized pairing successfully`,
        });
      }

      navigate("/cluster");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to add cluster node";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-wrapper space-y-6 sm:space-y-8">
      {/* Header & Back Navigation */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
        <div className="flex items-center gap-3">
          {/* <button
            onClick={() => navigate("/cluster")}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10 transition-colors"
            title="Back to Cluster"
          >
            <ArrowLeft size={18} />
          </button> */}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Server className="text-cyan-500" size={24} />
              Add Cluster Host & Configure HA
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Configure new server node connection and High Availability
              topology for Kea DHCP.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-start gap-3">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <span className="font-semibold block">Error:</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Node Connection Details */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Network size={16} className="text-cyan-500" />
              Node Connection Details
            </h2>
            <span className="text-[11px] text-slate-400">
              Endpoint & IP Address
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Node Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Secondary Node (Hot-Standby)"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Identifier used for this node across cluster synchronization and
                Kea HA hooks.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Host IP Address or FQDN <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={host}
                onChange={handleHostChange}
                placeholder="e.g. 192.168.1.51"
                className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Network IP address or FQDN reachable by peer nodes.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Web UI & Sync Port
              </label>
              <input
                type="number"
                value={uiPort}
                onChange={(e) => setUiPort(Number(e.target.value))}
                min={1}
                max={65535}
                className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Port for configuration synchronization via Web API (default:
                3000)
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Kea Control Agent URL
              </label>
              <input
                type="text"
                value={agentUrl}
                onChange={(e) => setAgentUrl(e.target.value)}
                placeholder="http://192.168.1.51:8000"
                className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                URL for command execution and lease replication to Kea daemon
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: HA Topology & Cluster Strategy */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers size={16} className="text-indigo-500" />
              High Availability Strategy & Node Role
            </h2>
            <span className="text-[11px] text-slate-400">
              HA Mode & Failover
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Node Role Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Assigned Node Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as NodeRole)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="secondary">
                  Secondary (Standby / Partner Peer)
                </option>
                <option value="primary">Primary (Active Server)</option>
                <option value="backup">Backup (Cold Standby)</option>
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Assigned role for this node. In a 2-node HA topology, this
                should typically be Secondary.
              </span>
            </div>

            {/* Cluster Mode Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Cluster High Availability Mode
              </label>
              <select
                value={clusterMode}
                onChange={(e) => setClusterMode(e.target.value as ClusterMode)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="failover">
                  Failover (Hot-Standby) - Recommended
                </option>
                <option value="load-balancing">
                  Load Balancing (Active-Active)
                </option>
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Hot-Standby: Primary serves leases; Secondary automatically
                assumes serving on failure.
              </span>
            </div>
          </div>

          {/* HA Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Activate Kea HA Hook
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Automatically configure libdhcp_ha.so hook library
                </span>
              </div>
              <input
                type="checkbox"
                checked={enableHa}
                onChange={(e) => setEnableHa(e.target.checked)}
                className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500"
              />
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Automatic Failover
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Automatically switch operational state if partner heartbeat is
                  lost
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoFailover}
                onChange={(e) => setAutoFailover(e.target.checked)}
                className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Security & Automatic Handshake */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield size={16} className="text-emerald-500" />
              Security & Remote Pairing Handshake
            </h2>
            <span className="text-[11px] text-slate-400">
              Authentication & Mutual Trust
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cluster Shared Secret */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Cluster Shared Secret
              </label>
              <div className="relative">
                <input
                  type={showSecret ? "text" : "password"}
                  value={clusterSecret}
                  onChange={(e) => setClusterSecret(e.target.value)}
                  className="w-full pl-3.5 pr-20 py-2.5 text-xs font-mono rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  required
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title={showSecret ? "Hide Secret" : "Show Secret"}
                  >
                    {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title="Copy Secret"
                  >
                    {secretCopied ? (
                      <Check size={14} className="text-emerald-500" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Shared secret for mutual authentication and payload encryption
                across cluster nodes.
              </span>
            </div>

            {/* Remote Admin Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Remote Node Admin Password (Optional)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Remote node admin password"
                  className="w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                If provided, performs automatic mutual pairing handshake and
                registers the peer node immediately.
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: Live Connection Test & Diagnostic */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity size={16} className="text-cyan-500" />
                Connection Diagnostic
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Test Web UI and Kea Control Agent port reachability before
                saving
              </p>
            </div>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 transition-colors flex items-center gap-2 self-start sm:self-auto disabled:opacity-50"
            >
              {testing ? (
                <Loader2 size={14} className="animate-spin text-cyan-500" />
              ) : (
                <Radio size={14} className="text-cyan-500" />
              )}
              Test Connection
            </button>
          </div>

          {testResult && (
            <div
              className={`p-4 rounded-xl text-xs border ${
                testResult.success
                  ? "bg-emerald-50/60 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                  : "bg-rose-50/60 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-800 dark:text-rose-300"
              }`}
            >
              <div className="flex items-center gap-2 font-bold mb-1.5">
                {testResult.success ? (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                ) : (
                  <AlertCircle size={16} className="text-rose-500" />
                )}
                <span>{testResult.message}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 pt-2 border-t border-black/5 dark:border-white/5 text-[11px]">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">
                    Web UI Reachable:
                  </span>
                  <span className="font-semibold">
                    {testResult.uiReachable ? "✅ Reachable" : "❌ Unreachable"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">
                    Kea Agent Reachable:
                  </span>
                  <span className="font-semibold">
                    {testResult.agentReachable
                      ? "✅ Reachable"
                      : "❌ Unreachable"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">
                    Latency:
                  </span>
                  <span className="font-mono font-semibold">
                    {testResult.latencyMs !== undefined
                      ? `${testResult.latencyMs}ms`
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Network & Port Pre-requisites Information */}
        <div className="p-4 rounded-2xl bg-cyan-50/50 dark:bg-cyan-500/5 border border-cyan-200/80 dark:border-cyan-500/20 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-3">
          <Info size={18} className="text-cyan-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-slate-800 dark:text-slate-200 block">
              Network Firewall Prerequisites between Nodes:
            </span>
            <ul className="list-disc list-inside space-y-0.5 text-[11px]">
              <li>
                <strong>TCP Port {uiPort}:</strong> Configuration
                synchronization and heartbeat REST API
              </li>
              <li>
                <strong>TCP Port 8000:</strong> ISC Kea Control Agent for HA
                status and lease replication
              </li>
              <li>
                <strong>UDP Port 67:</strong> DHCP traffic and failover lease
                updates
              </li>
            </ul>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
          <button
            type="button"
            onClick={() => navigate("/cluster")}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/25 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Server size={14} />
            )}
            Add & Initialize Cluster Node
          </button>
        </div>
      </form>
    </div>
  );
}
