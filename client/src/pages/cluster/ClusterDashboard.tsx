import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  Layers,
  Server,
  RefreshCw,
  Plus,
  Settings2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Network,
  GitCompare,
  ArrowRight,
  ArrowLeft,
  Shield,
  Activity,
  Radio,
  Clock,
  Send,
  Loader2,
  Trash2,
  Edit2,
  KeyRound,
  Copy,
  Check,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  ClusterOverview,
  ClusterNode,
  ClusterSettings,
  SyncLogEntry,
  ClusterDiffResult,
  NotificationState,
  ClusterMode,
} from "@shared";
import { ClusterHostModal } from "./ClusterHostModal";
import { ClusterDiffModal } from "./ClusterDiffModal";
import { ConfirmModal } from "../../components/ConfirmModal";

export interface ClusterDashboardProps {
  setNotification?: (notif: NotificationState) => void;
}

export function ClusterDashboard({ setNotification }: ClusterDashboardProps) {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();

  const [overview, setOverview] = useState<ClusterOverview | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [triggeringHaSync, setTriggeringHaSync] = useState(false);
  const [pullingFromPrimary, setPullingFromPrimary] = useState(false);

  // Inline Settings Edit State
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [panelMode, setPanelMode] = useState<ClusterMode>("failover");
  const [panelEnabled, setPanelEnabled] = useState(true);
  const [panelAutoSync, setPanelAutoSync] = useState(true);
  const [panelSecret, setPanelSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  // Modals state
  const [hostModalOpen, setHostModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<ClusterNode | null>(null);

  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [diffNode, setDiffNode] = useState<ClusterNode | null>(null);
  const [diffResult, setDiffResult] = useState<ClusterDiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ClusterNode | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Testing & Syncing per-node state
  const [testingNodeId, setTestingNodeId] = useState<string | null>(null);
  const [syncingNodeId, setSyncingNodeId] = useState<string | null>(null);

  const fetchOverview = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      const [resOverview, resLogs] = await Promise.all([
        apiFetch("/api/cluster/overview"),
        apiFetch("/api/cluster/sync/logs"),
      ]);

      if (resOverview.ok) {
        const data = await resOverview.json();
        setOverview(data);
        if (data.settings) {
          setPanelMode(data.settings.mode || "failover");
          setPanelEnabled(data.settings.enabled !== false);
          setPanelAutoSync(data.settings.autoSyncOnSave !== false);
          setPanelSecret(data.settings.clusterSecret || "");
        }
      }
      if (resLogs.ok) {
        const logsData = await resLogs.json();
        setSyncLogs(Array.isArray(logsData) ? logsData : []);
      }
    } catch (err: unknown) {
      if (setNotification) {
        const msg =
          err instanceof Error ? err.message : "Failed to fetch cluster status";
        setNotification({ type: "error", message: msg });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(() => fetchOverview(), 15000);
    return () => clearInterval(interval);
  }, []);

  const handleTestConnection = async (nodePartial: Partial<ClusterNode>) => {
    if (nodePartial.id) {
      setTestingNodeId(nodePartial.id);
      try {
        const res = await apiFetch(
          `/api/cluster/nodes/${nodePartial.id}/test`,
          {
            method: "POST",
          },
        );
        const data = await res.json();
        if (setNotification) {
          setNotification({
            type: data.success ? "success" : "error",
            message: `${nodePartial.name || "Node"}: ${data.message}`,
          });
        }
        await fetchOverview();
        return data;
      } finally {
        setTestingNodeId(null);
      }
    }

    const res = await apiFetch(`/api/cluster/nodes/test-temp`, {
      method: "POST",
      body: JSON.stringify(nodePartial),
    });
    return await res.json();
  };

  const handleSaveHost = async (nodeData: Partial<ClusterNode>) => {
    if (editingNode) {
      const res = await apiFetch(`/api/cluster/nodes/${editingNode.id}`, {
        method: "PUT",
        body: JSON.stringify(nodeData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update node");
      }
      if (setNotification) {
        setNotification({
          type: "success",
          message: `Node '${nodeData.name}' updated successfully`,
        });
      }
    } else {
      const res = await apiFetch("/api/cluster/nodes", {
        method: "POST",
        body: JSON.stringify(nodeData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add node");
      }
      if (setNotification) {
        setNotification({
          type: "success",
          message: `Node '${nodeData.name}' added to cluster`,
        });
      }
    }
    await fetchOverview();
  };

  const handleDeleteHost = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await apiFetch(`/api/cluster/nodes/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to remove node");
      }
      if (setNotification) {
        setNotification({
          type: "success",
          message: `Node '${deleteTarget.name}' removed from cluster`,
        });
      }
      setDeleteTarget(null);
      await fetchOverview();
    } catch (err: unknown) {
      if (setNotification) {
        const msg =
          err instanceof Error ? err.message : "Failed to delete node";
        setNotification({ type: "error", message: msg });
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSaveInlineSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await apiFetch("/api/cluster/settings", {
        method: "PUT",
        body: JSON.stringify({
          enabled: panelEnabled,
          mode: panelMode,
          clusterSecret: panelSecret.trim(),
          autoSyncOnSave: panelAutoSync,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save cluster settings");
      }
      if (setNotification) {
        setNotification({
          type: "success",
          message: "Cluster HA settings updated successfully",
        });
      }
      await fetchOverview();
    } catch (err: unknown) {
      if (setNotification) {
        const msg =
          err instanceof Error ? err.message : "Failed to save settings";
        setNotification({ type: "error", message: msg });
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCopySecret = () => {
    if (!panelSecret) return;
    navigator.clipboard.writeText(panelSecret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await apiFetch("/api/cluster/sync/push", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (setNotification) {
        setNotification({
          type: data.failed === 0 ? "success" : "warning",
          message: `Broadcast sync completed: ${data.successful}/${data.total} node(s) synced`,
        });
      }
      await fetchOverview();
    } catch (err: unknown) {
      if (setNotification) {
        const msg =
          err instanceof Error ? err.message : "Sync broadcast failed";
        setNotification({ type: "error", message: msg });
      }
    } finally {
      setSyncingAll(false);
    }
  };

  const handleSyncNode = async (node: ClusterNode) => {
    setSyncingNodeId(node.id);
    try {
      const res = await apiFetch("/api/cluster/sync/push", {
        method: "POST",
        body: JSON.stringify({ nodeId: node.id }),
      });
      const data = await res.json();
      if (setNotification) {
        setNotification({
          type: data.success ? "success" : "error",
          message: `${node.name}: ${data.message || "Synced"}`,
        });
      }
      await fetchOverview();
    } catch (err: unknown) {
      if (setNotification) {
        const msg = err instanceof Error ? err.message : "Node sync failed";
        setNotification({ type: "error", message: msg });
      }
    } finally {
      setSyncingNodeId(null);
    }
  };

  const handlePullFromPrimary = async (targetNodeId?: string) => {
    setPullingFromPrimary(true);
    try {
      const res = await apiFetch("/api/cluster/sync/pull-from-node", {
        method: "POST",
        body: JSON.stringify({ nodeId: targetNodeId }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || data.message || "Failed to pull configuration");
      }
      if (setNotification) {
        setNotification({
          type: "success",
          message: data.message || "Synchronized configuration from Primary successfully",
        });
      }
      await fetchOverview();
    } catch (err: unknown) {
      if (setNotification) {
        const msg =
          err instanceof Error ? err.message : "Failed to pull configuration from Primary";
        setNotification({ type: "error", message: msg });
      }
    } finally {
      setPullingFromPrimary(false);
    }
  };

  const handleTriggerKeaHaSync = async () => {
    setTriggeringHaSync(true);
    try {
      const res = await apiFetch("/api/cluster/ha/action", {
        method: "POST",
        body: JSON.stringify({ action: "ha-sync" }),
      });
      const data = await res.json();
      if (setNotification) {
        setNotification({
          type: data.success ? "success" : "error",
          message: data.message,
        });
      }
      await fetchOverview();
    } catch (err: unknown) {
      if (setNotification) {
        const msg = err instanceof Error ? err.message : "Kea HA sync failed";
        setNotification({ type: "error", message: msg });
      }
    } finally {
      setTriggeringHaSync(false);
    }
  };

  const handleOpenDiff = async (node: ClusterNode) => {
    setDiffNode(node);
    setDiffModalOpen(true);
    await fetchDiffForNode(node.id);
  };

  const fetchDiffForNode = async (nodeId: string) => {
    setDiffLoading(true);
    try {
      const res = await apiFetch(`/api/cluster/sync/diff/${nodeId}`);
      if (res.ok) {
        const data = await res.json();
        setDiffResult(data);
      } else {
        setDiffResult(null);
      }
    } catch {
      setDiffResult(null);
    } finally {
      setDiffLoading(false);
    }
  };

  const settings = overview?.settings;
  const nodes = overview?.nodes || [];
  const summary = overview?.summary;

  // Secondary Node conflict / notification detection
  const localNode = nodes.find((n) => n.isLocal);
  const isSecondary = localNode?.role === "secondary";
  const primaryNode =
    nodes.find((n) => !n.isLocal && n.role === "primary") ||
    nodes.find((n) => !n.isLocal);

  const hasSecondaryConfigConflict =
    isSecondary &&
    (localNode?.syncStatus === "drift_detected" ||
      summary?.clusterHealth === "out_of_sync" ||
      (primaryNode && primaryNode.syncStatus === "drift_detected"));

  return (
    <div className="page-wrapper space-y-6 sm:space-y-8">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Layers className="text-cyan-500" size={26} />
              Cluster & High Availability
            </h1>
            {settings?.enabled ? (
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  settings.mode === "load-balancing"
                    ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
                    : "bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300"
                }`}
              >
                {settings.mode === "load-balancing"
                  ? "Load Balancing"
                  : "Failover (Hot Standby)"}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                Standalone / HA Disabled
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage Kea DHCP server nodes, automated configuration
            synchronization, and lease replication
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fetchOverview(true)}
            disabled={refreshing}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10 transition-colors"
            title="Refresh status"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </button>

          {settings?.enabled && (
            <button
              onClick={handleTriggerKeaHaSync}
              disabled={triggeringHaSync}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 transition-colors flex items-center gap-1.5"
              title="Trigger Kea HA ha-sync command to sync leases from partner"
            >
              {triggeringHaSync ? (
                <Loader2 size={14} className="animate-spin text-cyan-500" />
              ) : (
                <Radio size={14} className="text-indigo-500" />
              )}
              Trigger Lease Sync
            </button>
          )}

          <button
            onClick={handleSyncAll}
            disabled={
              syncingAll || nodes.filter((n) => !n.isLocal).length === 0
            }
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {syncingAll ? (
              <Loader2 size={14} className="animate-spin text-cyan-500" />
            ) : (
              <Send size={14} className="text-cyan-500" />
            )}
            Sync All Nodes
          </button>

          <button
            onClick={() => setShowSettingsPanel(!showSettingsPanel)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
              showSettingsPanel
                ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white border-slate-300 dark:border-white/20"
                : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10"
            }`}
          >
            <Settings2 size={14} />
            HA Policy
            {showSettingsPanel ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          <button
            onClick={() => navigate("/cluster/add")}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20 transition-all flex items-center gap-1.5"
          >
            <Plus size={15} />
            Add Host
          </button>
        </div>
      </div>

      {/* Secondary Node Config Conflict / Notification Banner */}
      {hasSecondaryConfigConflict && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
              <AlertTriangle size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Node Secondary: ตรวจพบการเปลี่ยนแปลงคอนฟิกจาก Node Primary (Hot-Standby / Config Update)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/60 dark:bg-amber-400/20 text-amber-800 dark:text-amber-300">
                  Action Required
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                โหนดหลัก Primary ({primaryNode?.name || "Primary Node"}) มีการกำหนดค่า Hot-Standby หรือคอนฟิกใหม่ กรุณากดรับค่าเพื่ออัปเดตและซิงค์ให้ตรงกัน
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {primaryNode && (
              <button
                onClick={() => handleOpenDiff(primaryNode)}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10 transition-colors flex items-center gap-1.5"
              >
                <GitCompare size={14} />
                View Diff
              </button>
            )}
            <button
              onClick={() => handlePullFromPrimary(primaryNode?.id)}
              disabled={pullingFromPrimary}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {pullingFromPrimary ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              ดึงและรับค่า Config จาก Primary
            </button>
          </div>
        </div>
      )}

      {/* Cluster Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cluster Health Status */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 shadow-sm flex items-center gap-4">
          <div
            className={`p-3 rounded-xl ${
              summary?.clusterHealth === "healthy"
                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500"
                : summary?.clusterHealth === "out_of_sync"
                  ? "bg-amber-50 dark:bg-amber-500/10 text-amber-500"
                  : summary?.clusterHealth === "degraded"
                    ? "bg-orange-50 dark:bg-orange-500/10 text-orange-500"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400"
            }`}
          >
            <Shield size={24} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Cluster Status
            </span>
            <div className="text-lg font-bold text-slate-900 dark:text-white capitalize">
              {summary?.clusterHealth
                ? summary.clusterHealth.replace(/_/g, " ")
                : "Loading..."}
            </div>
          </div>
        </div>

        {/* Total & Online Nodes */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-500">
            <Server size={24} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Cluster Nodes
            </span>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {summary
                ? `${summary.onlineNodes} / ${summary.totalNodes} Online`
                : "0"}
            </div>
          </div>
        </div>

        {/* Sync Consistency */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500">
            <Activity size={24} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Config Synchronization
            </span>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {summary
                ? `${summary.syncedNodes} / ${summary.totalNodes} Synced`
                : "0"}
            </div>
          </div>
        </div>

        {/* Auto Sync State */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-500">
            <Clock size={24} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Auto Sync Policy
            </span>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {settings?.autoSyncOnSave ? "Active on Save" : "Manual Push"}
            </div>
          </div>
        </div>
      </div>

      {/* Streamlined Cluster HA Policy Panel (Inline, eliminating popup modal) */}
      {showSettingsPanel && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 shadow-sm space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
            <div className="flex items-center gap-2.5">
              <Settings2 size={18} className="text-indigo-500" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Cluster High Availability Policy & Shared Security
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ปรับเปลี่ยนโหมด HA และจัดการคีย์ลับโดยตรงในหน้านี้โดยไม่ต้องเปิดป๊อปอัพ
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSettingsPanel(false)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              ซ่อนแผงตั้งค่า
            </button>
          </div>

          <form onSubmit={handleSaveInlineSettings} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Cluster HA Mode
                </label>
                <select
                  value={panelMode}
                  onChange={(e) => setPanelMode(e.target.value as ClusterMode)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="failover">Failover (Hot Standby)</option>
                  <option value="load-balancing">Load Balancing</option>
                  <option value="standalone">Standalone (Disabled)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Cluster Secret
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? "text" : "password"}
                    value={panelSecret}
                    onChange={(e) => setPanelSecret(e.target.value)}
                    className="w-full pl-3 pr-16 py-2 text-xs font-mono rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    required
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {secretCopied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-5">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={panelEnabled}
                    onChange={(e) => setPanelEnabled(e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500"
                  />
                  Enable HA
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={panelAutoSync}
                    onChange={(e) => setPanelAutoSync(e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500"
                  />
                  Auto-sync on Save
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingSettings ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                Save HA Policy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cluster Server Nodes: Redesigned as Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Server size={18} className="text-cyan-500" />
            Cluster Server Nodes ({nodes.length})
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {settings?.mode === "load-balancing"
              ? "Load Balancing (Active-Active)"
              : "Failover (Active-Standby)"}
          </span>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400">
            <Loader2 size={32} className="animate-spin text-cyan-500 mb-3" />
            <span className="text-xs">
              Loading cluster topology and node health...
            </span>
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/10 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px] bg-slate-50/60 dark:bg-slate-800/40">
                    <th className="py-3.5 px-4">Node Name & Role</th>
                    <th className="py-3.5 px-4">IP Address & Endpoints</th>
                    <th className="py-3.5 px-4">Health Status</th>
                    <th className="py-3.5 px-4">Config Sync</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {nodes.map((node) => {
                    const isTesting = testingNodeId === node.id;
                    const isSyncing = syncingNodeId === node.id;

                    return (
                      <tr
                        key={node.id}
                        className={`hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors ${
                          node.isLocal
                            ? "bg-cyan-50/20 dark:bg-cyan-900/10"
                            : ""
                        }`}
                      >
                        {/* Node Name & Role Column */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              <Server size={16} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {node.name}
                                </span>
                                {node.isLocal && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300">
                                    LOCAL
                                  </span>
                                )}
                              </div>
                              <span
                                className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  node.role === "primary"
                                    ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300"
                                    : node.role === "secondary"
                                      ? "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300"
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                }`}
                              >
                                {node.role === "secondary" ? "Secondary (Standby)" : node.role}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* IP Address & Endpoints Column */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <span className="font-mono font-medium text-slate-800 dark:text-slate-200 block">
                              {node.host}:{node.uiPort}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400 block truncate max-w-xs" title={node.agentUrl}>
                              {node.agentUrl || `http://${node.host}:8000`}
                            </span>
                          </div>
                        </td>

                        {/* Health Status Column */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            {node.status === "online" ? (
                              <>
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                  Online
                                </span>
                                {node.latencyMs !== undefined && (
                                  <span className="text-[11px] text-slate-400 font-mono">
                                    ({node.latencyMs}ms)
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                                <span className="text-rose-600 dark:text-rose-400 font-semibold capitalize">
                                  {node.status || "Offline"}
                                </span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Config Sync Column */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-medium">
                              {node.syncStatus === "synced" ? (
                                <>
                                  <CheckCircle2
                                    size={14}
                                    className="text-emerald-500 shrink-0"
                                  />
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                    Synced
                                  </span>
                                </>
                              ) : node.syncStatus === "drift_detected" ? (
                                <>
                                  <AlertTriangle
                                    size={14}
                                    className="text-amber-500 shrink-0"
                                  />
                                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                    Drift Detected
                                  </span>
                                </>
                              ) : node.syncStatus === "syncing" ? (
                                <>
                                  <Loader2
                                    size={14}
                                    className="animate-spin text-cyan-500 shrink-0"
                                  />
                                  <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
                                    Syncing...
                                  </span>
                                </>
                              ) : (
                                <>
                                  <XCircle
                                    size={14}
                                    className="text-slate-400 shrink-0"
                                  />
                                  <span className="text-slate-500 capitalize">
                                    {node.syncStatus || "Pending"}
                                  </span>
                                </>
                              )}
                            </div>
                            {node.lastSyncTime && (
                              <span className="text-[10px] text-slate-400 block">
                                {new Date(node.lastSyncTime).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions Column */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleTestConnection(node)}
                              disabled={isTesting}
                              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                              title="Test Node Ping & Agent"
                            >
                              {isTesting ? (
                                <Loader2 size={14} className="animate-spin text-cyan-500" />
                              ) : (
                                <Network size={14} />
                              )}
                            </button>

                            {!node.isLocal && (
                              <>
                                <button
                                  onClick={() => handleOpenDiff(node)}
                                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                                  title="Compare Differences (Diff)"
                                >
                                  <GitCompare size={14} />
                                </button>

                                <button
                                  onClick={() => {
                                    if (isSecondary && node.role === "primary") {
                                      handlePullFromPrimary(node.id);
                                    } else {
                                      handleSyncNode(node);
                                    }
                                  }}
                                  disabled={isSyncing || pullingFromPrimary}
                                  className="p-1.5 rounded-lg text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 transition-colors"
                                  title={
                                    isSecondary && node.role === "primary"
                                      ? "Pull Config from Primary"
                                      : "Push Config to this node"
                                  }
                                >
                                  {isSyncing || (pullingFromPrimary && node.role === "primary") ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : isSecondary && node.role === "primary" ? (
                                    <ArrowLeft size={14} />
                                  ) : (
                                    <ArrowRight size={14} />
                                  )}
                                </button>

                                <button
                                  onClick={() => {
                                    setEditingNode(node);
                                    setHostModalOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                                  title="Edit Node"
                                >
                                  <Edit2 size={14} />
                                </button>

                                <button
                                  onClick={() => setDeleteTarget(node)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                                  title="Remove Node"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Sync Activity History Log */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock size={18} className="text-cyan-500" />
            Recent Synchronization History
          </h2>
          <span className="text-xs text-slate-400">Last 50 events</span>
        </div>

        {syncLogs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No synchronization activity recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/10 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Target Node</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {syncLogs.slice(0, 10).map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
                  >
                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {log.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                      {log.targetNodeName}
                    </td>
                    <td className="py-2.5 px-3">
                      {log.success ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <CheckCircle2 size={12} /> Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                          <XCircle size={12} /> Failed
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 truncate max-w-xs">
                      {log.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Host Modal (Used when clicking Edit action on an existing node) */}
      <ClusterHostModal
        isOpen={hostModalOpen}
        onClose={() => setHostModalOpen(false)}
        onSave={handleSaveHost}
        node={editingNode}
        onTestConnection={handleTestConnection}
      />

      {/* Diff Modal */}
      <ClusterDiffModal
        isOpen={diffModalOpen}
        onClose={() => setDiffModalOpen(false)}
        node={diffNode}
        diffResult={diffResult}
        loading={diffLoading}
        onRefreshDiff={() =>
          diffNode ? fetchDiffForNode(diffNode.id) : Promise.resolve()
        }
        onPushSync={() =>
          diffNode ? handleSyncNode(diffNode) : Promise.resolve()
        }
      />

      {/* Confirm Delete Node Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Remove Cluster Host"
        message={`Are you sure you want to remove host "${deleteTarget?.name}" (${deleteTarget?.host}) from the cluster? This node will no longer receive synchronized configurations.`}
        confirmText="Remove Host"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDeleteHost}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
