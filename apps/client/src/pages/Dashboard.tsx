import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { MetricCard } from "../components/MetricCard";
import {
  Network,
  Users,
  HardDrive,
  BookmarkCheck,
  RefreshCw,
  Plus,
  ArrowRight,
  ShieldCheck,
  Activity,
  Layers,
  Wifi,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { CopyText, NotificationState } from "../components/TableParts";
import { DhcpLease } from '@kea/shared';

export interface DashboardProps {
  setNotification?: (notif: NotificationState) => void;
}

interface ServiceSubStatus {
  service?: string;
  active?: boolean;
  pid?: number | string;
}

interface SubnetStatItem {
  id?: string | number;
  subnet: string;
  cidr?: number;
  reservationsCount?: number;
  utilization: number;
  range?: string;
  activeLeases: number;
  capacity: number;
}

interface DashboardApiData {
  counts?: {
    subnets?: number;
    totalCapacity?: number;
    activeLeases?: number;
    staticHosts?: number;
    utilizationPercentage?: number;
  };
  service?: {
    dhcp4?: ServiceSubStatus;
    ctrlAgent?: ServiceSubStatus;
  };
  subnetStats?: SubnetStatItem[];
  recentLeases?: DhcpLease[];
}

export function Dashboard({ setNotification }: DashboardProps) {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const [data, setData] = useState<DashboardApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchDashboardData = async (manual = false) => {
    try {
      if (manual) setRefreshing(true);
      const res = await apiFetch("/api/dashboard");
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      if (setNotification) {
        const msg =
          err instanceof Error ? err.message : "Error fetching dashboard data";
        setNotification({ type: "error", message: msg });
      }
    } finally {
      setLoading(false);
      if (manual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(() => fetchDashboardData(false), 5000);
    return () => clearInterval(interval);
  }, []);

  const counts = data?.counts || {};
  const isDhcpActive = data?.service?.dhcp4?.active ?? true;

  return (
    <div className="page-wrapper space-y-6 sm:space-y-8 animate-fadeIn">
      {/* Hero Operational Banner */}
      <div className="glass-card bg-gradient-to-r from-white via-slate-50 to-indigo-50/30 dark:from-slate-900/90 dark:via-slate-900/60 dark:to-indigo-950/20 border border-slate-200/80 dark:border-white/[0.08] p-5 sm:p-7 relative overflow-hidden shadow-sm">
        {/* Decorative background glow */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-40 -bottom-20 w-64 h-64 bg-cyan-500/10 dark:bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`badge ${
                  isDhcpActive ? "badge-active" : "badge-danger"
                }`}
              >
                <span className="pulse-dot" />
                {isDhcpActive ? "Kea DHCPv4 Engine Active" : "Kea DHCPv4 Offline"}
              </span>

              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-200/60 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                REST Control Agent v2.6+
              </span>

              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Kea DHCP Control Console
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-2xl leading-relaxed">
              Enterprise modular DHCPv4 management with real-time pool monitoring, high-availability replication, and instant lease control.
            </p>
          </div>

          {/* Quick Action Shortcuts */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
              className="btn btn-secondary text-xs sm:text-sm"
              title="Refresh telemetry"
            >
              <RefreshCw
                size={15}
                className={`text-slate-500 ${refreshing ? "animate-spin" : ""}`}
              />
              <span>Refresh</span>
            </button>

            <Link
              to="/scopes/add"
              className="btn btn-primary text-xs sm:text-sm"
            >
              <Plus size={16} />
              <span>Add Scope</span>
            </Link>

            <Link
              to="/leases"
              className="btn btn-secondary text-xs sm:text-sm"
            >
              <Wifi size={15} />
              <span>Leases</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Top 4 Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <MetricCard
          title="Configured Scopes"
          value={counts.subnets || 0}
          subtext="Active IPv4 allocation scopes"
          icon={Network}
          color="indigo"
          badge="Network"
        />

        <MetricCard
          title="Pool Capacity"
          value={counts.totalCapacity || 0}
          subtext="Assignable dynamic addresses"
          icon={HardDrive}
          color="cyan"
          badge="IP Space"
        />

        <MetricCard
          title="Dynamic Leases"
          value={counts.activeLeases || 0}
          subtext={`${counts.utilizationPercentage || 0}% overall pool utilization`}
          progress={counts.utilizationPercentage || 0}
          icon={Users}
          color="emerald"
          badge="Clients"
        />

        <MetricCard
          title="Static Reservations"
          value={counts.staticHosts || 0}
          subtext="Host MAC fixed bindings"
          icon={BookmarkCheck}
          color="amber"
          badge="Bindings"
        />
      </div>

      {/* Scope Pool Utilization Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Scope Pool Utilization
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
              Live capacity breakdown per configured subnet pool
            </p>
          </div>

          <Link
            to="/scopes"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors"
          >
            <span>Manage All Scopes ({counts.subnets || 0})</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {data?.subnetStats && data.subnetStats.length > 0 ? (
            data.subnetStats.map((s) => {
              const util = s.utilization || 0;
              const isCritical = util > 85;
              const isWarning = util > 60 && !isCritical;
              const freeIps = Math.max(0, s.capacity - s.activeLeases);

              return (
                <div
                  key={s.id || s.subnet}
                  className="glass-card-hover flex flex-col justify-between group"
                >
                  <div>
                    {/* Subnet CIDR & Status Badge */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="font-bold text-base text-slate-900 dark:text-white font-mono flex items-center gap-2">
                          <span>{s.subnet}/{s.cidr || 24}</span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Fixed Reservations: <strong className="font-mono text-slate-700 dark:text-slate-300">{s.reservationsCount || 0}</strong> hosts
                        </div>
                      </div>

                      <span
                        className={`badge shrink-0 ${
                          isCritical
                            ? "badge-danger"
                            : isWarning
                            ? "badge-warning"
                            : "badge-active"
                        }`}
                      >
                        {util}% Used
                      </span>
                    </div>

                    {/* Range & Usage Progress Bar */}
                    <div className="space-y-1.5 my-3.5">
                      <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400">
                        <span className="font-mono text-[11px] truncate text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded">
                          {s.range || "Dynamic Pool Range"}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white shrink-0 ml-2 font-mono">
                          {s.activeLeases} / {s.capacity} IPs
                        </span>
                      </div>

                      <div className="progress-bar-bg h-2.5">
                        <div
                          className={`progress-bar-fill ${
                            isCritical
                              ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
                              : isWarning
                              ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                              : "bg-gradient-to-r from-indigo-500 via-cyan-400 to-teal-400 shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, util))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Free IPs & Quick Jump */}
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-200/80 dark:border-white/[0.08] mt-2">
                    <span className="font-medium">
                      Free Capacity:{" "}
                      <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                        {freeIps} IPs
                      </strong>
                    </span>

                    <button
                      onClick={() => navigate(`/scopes/${s.id || s.subnet}/edit`)}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <span>Details</span>
                      <ExternalLink size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full glass-card text-center py-12">
              <Network size={36} className="mx-auto text-slate-400 mb-2 opacity-50" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No DHCP scopes currently configured
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Add an IPv4 scope to start managing DHCP dynamic address pools.
              </p>
              <Link to="/scopes/add" className="btn btn-primary text-xs mt-4 inline-flex">
                <Plus size={14} /> Add First Scope
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Recent Leases Table */}
      <div className="glass-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Recent Lease Activity
              </h2>
              <span className="badge badge-info">Real-time</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5">
              Live DHCP assignments granted by the Kea engine
            </p>
          </div>

          <Link
            to="/leases"
            className="btn btn-secondary text-xs sm:text-sm self-start sm:self-auto"
          >
            <span>View All Active Leases ({counts.activeLeases || 0})</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Assigned IP</th>
                <th>Hardware MAC</th>
                <th>Client Hostname</th>
                <th>Status</th>
                <th>Lease Expiration</th>
              </tr>
            </thead>
            <tbody>
              {data?.recentLeases && data.recentLeases.length > 0 ? (
                data.recentLeases.map((l) => (
                  <tr key={l.ip}>
                    {/* IP */}
                    <td>
                      <CopyText
                        value={l.ip}
                        setNotification={setNotification}
                        className="font-mono font-bold text-cyan-600 dark:text-cyan-400"
                      />
                    </td>

                    {/* MAC */}
                    <td>
                      <CopyText
                        value={l.mac}
                        setNotification={setNotification}
                        className="font-mono text-xs text-slate-600 dark:text-slate-400"
                      />
                    </td>

                    {/* Hostname */}
                    <td className="font-medium text-slate-800 dark:text-slate-200">
                      {l.hostname ? (
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-xs font-mono">
                          {l.hostname}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-xs">Unspecified</span>
                      )}
                    </td>

                    {/* Status */}
                    <td>
                      <span
                        className={`badge ${
                          l.status === "active" ? "badge-active" : "badge-warning"
                        }`}
                      >
                        <span className="pulse-dot" />
                        {l.status}
                      </span>
                    </td>

                    {/* Ends At */}
                    <td className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {l.ends ? new Date(l.ends).toLocaleString() : "Permanent / Reserved"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-12 text-slate-500 dark:text-slate-400"
                  >
                    <Wifi size={32} className="mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="font-semibold text-sm">No recent leases recorded</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Active client lease requests will appear here dynamically.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
