import React, { useState, useEffect } from "react";
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
  Shield,
  Activity,
  Radio,
  Clock,
  Send,
  Loader2,
  Trash2,
  Edit2,
} from "lucide-react";
import {
  ClusterOverview,
  ClusterNode,
  ClusterSettings,
  SyncLogEntry,
  ClusterDiffResult,
  NotificationState,
} from "@shared";
import { ClusterHostModal } from "./ClusterHostModal";
import { ClusterSettingsModal } from "./ClusterSettingsModal";
import { ClusterDiffModal } from "./ClusterDiffModal";
import { ConfirmModal } from "../../components/ConfirmModal";

export interface ClusterDashboardProps {
  setNotification?: (notif: NotificationState) => void;
}

export function ClusterDashboard({ setNotification }: ClusterDashboardProps) {
  const { apiFetch } = useAuth();

  const [overview, setOverview] = useState<ClusterOverview | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [triggeringHaSync, setTriggeringHaSync] = useState(false);

  // Modals state
  const [hostModalOpen, setHostModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<ClusterNode | null>(null);

  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [diffNode, setDiffNode] = useState<ClusterNode | null>(null);
  const [diffResult, setDiffResult] = useState<ClusterDiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ClusterNode | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Testing per-node state
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
    // If it's an existing node with an ID
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

    // Direct endpoint test for new unsaved host
    const res = await apiFetch(`/api/cluster/nodes/test-temp`, {
      method: "POST",
      body: JSON.stringify(nodePartial),
    }).catch(() => null);

    if (res && res.ok) {
      return await res.json();
    }

    return {
      success: false,
      message: "Connection test completed",
    };
  };

  const handleSaveHost = async (nodeData: Partial<ClusterNode>) => {
    if (editingNode) {
      const res = await apiFetch(`/api/cluster/nodes/${editingNode.id}`, {
        method: "PUT",
        body: JSON.stringify(nodeData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update host");
      }
      if (setNotification) {
        setNotification({
          type: "success",
          message: "Host updated successfully",
        });
      }
    } else {
      const res = await apiFetch("/api/cluster/nodes", {
        method: "POST",
        body: JSON.stringify(nodeData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add host");
      }
      if (setNotification) {
        setNotification({ type: "success", message: "Host added to cluster" });
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
        throw new Error(err.error || "Failed to delete host");
      }
      if (setNotification) {
        setNotification({
          type: "success",
          message: "Host removed from cluster",
        });
      }
      setDeleteTarget(null);
      await fetchOverview();
    } catch (err: unknown) {
      if (setNotification) {
        const msg =
          err instanceof Error ? err.message : "Failed to delete host";
        setNotification({ type: "error", message: msg });
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSaveSettings = async (settingsData: Partial<ClusterSettings>) => {
    const res = await apiFetch("/api/cluster/settings", {
      method: "PUT",
      body: JSON.stringify(settingsData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to save cluster settings");
    }
    if (setNotification) {
      setNotification({
        type: "success",
        message: "Cluster settings applied and Kea HA updated",
      });
    }
    await fetchOverview();
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
            onClick={() => setSettingsModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 transition-colors flex items-center gap-1.5"
          >
            <Settings2 size={14} />
            Settings
          </button>

          <button
            onClick={() => {
              setEditingNode(null);
              setHostModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20 transition-all flex items-center gap-1.5"
          >
            <Plus size={15} />
            Add Host
          </button>
        </div>
      </div>

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

      {/* Topology & Host Management Section */}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nodes.map((node) => {
              const isTesting = testingNodeId === node.id;
              const isSyncing = syncingNodeId === node.id;

              return (
                <div
                  key={node.id}
                  className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all ${
                    node.isLocal
                      ? "border-cyan-500/40 dark:border-cyan-500/30 shadow-md ring-1 ring-cyan-500/20"
                      : "border-slate-200/80 dark:border-white/10 shadow-sm"
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {node.name}
                        </h3>
                        {node.isLocal && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300">
                            LOCAL
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 block mt-0.5">
                        {node.host}:{node.uiPort}
                      </span>
                    </div>

                    {/* Role Badge */}
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                        node.role === "primary"
                          ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300"
                          : node.role === "secondary"
                            ? "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {node.role}
                    </span>
                  </div>

                  {/* Status Grid */}
                  <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 text-xs mb-4">
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">
                        Health Status
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5 font-medium">
                        {node.status === "online" ? (
                          <>
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-emerald-600 dark:text-emerald-400">
                              Online
                            </span>
                            {node.latencyMs !== undefined && (
                              <span className="text-[10px] text-slate-400">
                                ({node.latencyMs}ms)
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="w-2 h-2 rounded-full bg-rose-500" />
                            <span className="text-rose-600 dark:text-rose-400 capitalize">
                              {node.status || "Offline"}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">
                        Config Sync
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5 font-medium">
                        {node.syncStatus === "synced" ? (
                          <>
                            <CheckCircle2
                              size={13}
                              className="text-emerald-500 shrink-0"
                            />
                            <span className="text-emerald-600 dark:text-emerald-400">
                              Synced
                            </span>
                          </>
                        ) : node.syncStatus === "drift_detected" ? (
                          <>
                            <AlertTriangle
                              size={13}
                              className="text-amber-500 shrink-0"
                            />
                            <span className="text-amber-600 dark:text-amber-400">
                              Drift
                            </span>
                          </>
                        ) : node.syncStatus === "syncing" ? (
                          <>
                            <Loader2
                              size={13}
                              className="animate-spin text-cyan-500 shrink-0"
                            />
                            <span className="text-cyan-600 dark:text-cyan-400">
                              Syncing...
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle
                              size={13}
                              className="text-slate-400 shrink-0"
                            />
                            <span className="text-slate-500 capitalize">
                              {node.syncStatus || "Pending"}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleTestConnection(node)}
                        disabled={isTesting}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-xs flex items-center gap-1"
                        title="Test Connection"
                      >
                        {isTesting ? (
                          <Loader2
                            size={14}
                            className="animate-spin text-cyan-500"
                          />
                        ) : (
                          <Network size={14} />
                        )}
                        <span className="text-[11px]">Ping</span>
                      </button>

                      {!node.isLocal && (
                        <>
                          <button
                            onClick={() => handleOpenDiff(node)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-xs flex items-center gap-1"
                            title="Compare Config Diff"
                          >
                            <GitCompare size={14} />
                            <span className="text-[11px]">Diff</span>
                          </button>

                          <button
                            onClick={() => handleSyncNode(node)}
                            disabled={isSyncing}
                            className="p-1.5 rounded-lg text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 transition-colors text-xs flex items-center gap-1"
                            title="Push Config to this node"
                          >
                            {isSyncing ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <ArrowRight size={14} />
                            )}
                            <span className="text-[11px]">Sync</span>
                          </button>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
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

                      {!node.isLocal && (
                        <button
                          onClick={() => setDeleteTarget(node)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                          title="Delete Node"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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

      {/* Host Modal */}
      <ClusterHostModal
        isOpen={hostModalOpen}
        onClose={() => setHostModalOpen(false)}
        onSave={handleSaveHost}
        node={editingNode}
        onTestConnection={handleTestConnection}
      />

      {/* Settings Modal */}
      <ClusterSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        settings={settings || null}
        onSave={handleSaveSettings}
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
