import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MetricCard } from '../components/MetricCard';
import {
  Network,
  Users,
  HardDrive,
  BookmarkCheck,
  RefreshCw,
  Server,
  Activity,
  RotateCw,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export function Dashboard({ setNotification }) {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serviceActionLoading, setServiceActionLoading] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/dashboard');
      const json = await res.json();
      setData(json);
    } catch (err) {
      if (setNotification) {
        setNotification({ type: 'danger', message: err.message });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRestartService = async (target, label) => {
    try {
      setServiceActionLoading(true);
      const res = await apiFetch('/api/service/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart', target })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to restart service');
      if (setNotification) {
        setNotification({ type: 'success', message: `${label} restarted successfully` });
      }
      await fetchDashboardData();
    } catch (err) {
      if (setNotification) {
        setNotification({ type: 'danger', message: err.message });
      }
    } finally {
      setServiceActionLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="page-wrapper text-center py-24">
        <RefreshCw className="pulse-dot mx-auto mb-4 text-indigo-500" size={32} />
        <div className="text-slate-500 dark:text-slate-400 font-medium">
          Loading Kea Dashboard Overview...
        </div>
      </div>
    );
  }

  const counts = data?.counts || {};
  const dhcp4Service = data?.service?.dhcp4 || {};
  const ctrlAgentService = data?.service?.ctrlAgent || {};

  return (
    <div className="page-wrapper space-y-6 sm:space-y-8">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-1">
            Kea DHCP Server Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            High-performance modular DHCPv4 with REST Control Agent
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            className="btn btn-secondary text-xs sm:text-sm"
            onClick={fetchDashboardData}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Dual Service Status Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Kea DHCP4 Server Status */}
        <div className="glass-card p-5 border border-slate-200/80 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
              dhcp4Service.active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
            }`}>
              <Server size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900 dark:text-white font-mono">
                  {dhcp4Service.service || 'kea-dhcp4-server'}
                </span>
                <span className={`badge ${dhcp4Service.active ? 'badge-active' : 'badge-danger'}`}>
                  {dhcp4Service.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                IPv4 Engine {dhcp4Service.pid ? `• PID ${dhcp4Service.pid}` : ''}
              </p>
            </div>
          </div>
          <button
            className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
            onClick={() => handleRestartService('dhcp4', 'Kea DHCPv4')}
            disabled={serviceActionLoading}
          >
            <RotateCw size={13} className={serviceActionLoading ? 'animate-spin' : ''} />
            Restart
          </button>
        </div>

        {/* Kea Control Agent Status */}
        <div className="glass-card p-5 border border-slate-200/80 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
              ctrlAgentService.active ? 'bg-cyan-500/10 text-cyan-500' : 'bg-rose-500/10 text-rose-500'
            }`}>
              <Activity size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900 dark:text-white font-mono">
                  {ctrlAgentService.service || 'kea-ctrl-agent'}
                </span>
                <span className={`badge ${ctrlAgentService.active ? 'badge-active' : 'badge-danger'}`}>
                  {ctrlAgentService.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                REST Control Agent (Port 8000) {ctrlAgentService.pid ? `• PID ${ctrlAgentService.pid}` : ''}
              </p>
            </div>
          </div>
          <button
            className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
            onClick={() => handleRestartService('ctrl-agent', 'Kea Control Agent')}
            disabled={serviceActionLoading}
          >
            <RotateCw size={13} className={serviceActionLoading ? 'animate-spin' : ''} />
            Restart
          </button>
        </div>
      </div>

      {/* Top 4 Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <MetricCard
          title="Total Scopes"
          value={counts.subnets || 0}
          subtext="Configured DHCPv4 subnets"
          icon={Network}
          color="indigo"
        />

        <MetricCard
          title="Pool IP Capacity"
          value={counts.totalCapacity || 0}
          subtext="Total assignable dynamic IPs"
          icon={HardDrive}
          color="cyan"
        />

        <MetricCard
          title="Active Dynamic Leases"
          value={counts.activeLeases || 0}
          subtext={`${counts.utilizationPercentage || 0}% overall pool utilization`}
          progress={counts.utilizationPercentage || 0}
          icon={Users}
          color="emerald"
        />

        <MetricCard
          title="Static Reservations"
          value={counts.staticHosts || 0}
          subtext="Integrated host bindings"
          icon={BookmarkCheck}
          color="amber"
        />
      </div>

      {/* Subnet Pool Utilization Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Scope Pool Utilization
          </h2>
          <button
            className="text-xs sm:text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            onClick={() => navigate('/scopes')}
          >
            Manage Scopes & Reservations →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {data?.subnetStats?.map((s) => (
            <div key={s.id || s.subnet} className="glass-card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-bold text-base text-slate-900 dark:text-white font-mono">
                      {s.subnet}/{s.cidr || 24}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Reservations: {s.reservationsCount || 0} hosts
                    </div>
                  </div>
                  <span
                    className={`badge ${
                      s.utilization > 85 ? 'badge-danger' : s.utilization > 60 ? 'badge-warning' : 'badge-active'
                    }`}
                  >
                    {s.utilization}% Used
                  </span>
                </div>

                <div className="space-y-1.5 my-3">
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-mono truncate">{s.range}</span>
                    <span className="font-semibold text-slate-900 dark:text-white shrink-0 ml-2">
                      {s.activeLeases} / {s.capacity} IPs
                    </span>
                  </div>
                  <div className="progress-bar-bg">
                    <div
                      className={`progress-bar-fill ${
                        s.utilization > 85
                          ? 'bg-rose-500'
                          : s.utilization > 60
                          ? 'bg-amber-500'
                          : 'bg-gradient-to-r from-indigo-500 to-cyan-400'
                      }`}
                      style={{ width: `${s.utilization}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/80 dark:border-white/10 mt-2">
                <span>Available: {Math.max(0, s.capacity - s.activeLeases)} IPs</span>
                <span>Active: {s.activeLeases} Clients</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Leases Table */}
      <div className="glass-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Recent Lease Activity
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
              Latest DHCP leases granted via Kea Control Agent
            </p>
          </div>
          <button
            className="btn btn-secondary text-xs sm:text-sm self-start sm:self-auto"
            onClick={() => navigate('/leases')}
          >
            View All Leases ({counts.activeLeases || 0}) →
          </button>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>IP Address</th>
                <th>MAC Address</th>
                <th>Hostname</th>
                <th>Status</th>
                <th>Ends At (UTC)</th>
              </tr>
            </thead>
            <tbody>
              {data?.recentLeases?.length > 0 ? (
                data.recentLeases.map((l) => (
                  <tr key={l.ip}>
                    <td className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                      {l.ip}
                    </td>
                    <td className="font-mono text-slate-600 dark:text-slate-400">
                      {l.mac || 'N/A'}
                    </td>
                    <td className="font-medium">
                      {l.hostname || <span className="text-slate-400 italic">Unknown</span>}
                    </td>
                    <td>
                      <span className={`badge ${l.status === 'active' ? 'badge-active' : 'badge-warning'}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="text-xs text-slate-500 dark:text-slate-400">
                      {l.ends ? new Date(l.ends).toLocaleString() : 'N/A'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-slate-500 dark:text-slate-400">
                    No lease records found
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
