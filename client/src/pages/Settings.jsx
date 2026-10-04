import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  RotateCw,
  RefreshCw,
  Power,
  Activity,
  Server,
  FileCode,
  Shield,
  Clock,
  Save,
  Sliders,
  Globe,
  Radio
} from 'lucide-react';

export function Settings({ setNotification }) {
  const { apiFetch } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  // Global Settings state
  const [settings, setSettings] = useState({
    defaultLeaseTime: 4000,
    renewTimer: 1000,
    rebindTimer: 2000,
    authoritative: false,
    domainName: '',
    domainNameServers: '8.8.8.8, 1.1.1.1'
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/service/status');
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      if (setNotification) setNotification({ type: 'danger', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      setSettingsLoading(true);
      const res = await apiFetch('/api/service/settings');
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      if (setNotification) setNotification({ type: 'danger', message: err.message });
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchSettings();
  }, []);

  const handleAction = (action, target = 'all') => {
    setPendingAction({ action, target });
  };

  const runAction = async () => {
    if (!pendingAction) return;
    const { action, target } = pendingAction;

    try {
      setActionLoading(true);
      const res = await apiFetch('/api/service/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (setNotification) setNotification({ type: 'success', message: data.message });
      await fetchStatus();
    } catch (err) {
      if (setNotification) setNotification({ type: 'danger', message: err.message });
    } finally {
      setActionLoading(false);
      setPendingAction(null);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      const res = await apiFetch('/api/service/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettings(data);
      if (setNotification) {
        setNotification({
          type: 'success',
          message: 'Kea DHCP global settings updated successfully and persisted to disk.',
        });
      }
    } catch (err) {
      if (setNotification) setNotification({ type: 'danger', message: err.message });
    } finally {
      setSavingSettings(false);
    }
  };



  const dhcp4 = status?.dhcp4 || {};
  const ctrlAgent = status?.ctrlAgent || {};

  return (
    <div className="page-wrapper space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-1">
            System Settings & Kea Service Controls
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Manage Kea DHCPv4 daemon, Control Agent REST API, and global IP lease parameters
          </p>
        </div>
      </div>

      {/* Section 1: Dual Service Controls */}
      <div className="glass-card space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200/80 dark:border-white/10">
          <Activity size={20} className="text-cyan-500" />
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Kea Dual-Service Operations
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Control both the DHCPv4 daemon and the REST Control Agent service
            </p>
          </div>
        </div>

        {/* DHCPv4 Service Card */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border transition-colors ${
                dhcp4.active
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
              }`}
            >
              <Server size={24} />
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap mb-1">
                <span className="font-mono font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  {dhcp4.service || 'kea-dhcp4-server'}
                </span>
                <span className={`badge ${dhcp4.active ? 'badge-active' : 'badge-danger'}`}>
                  {dhcp4.active ? 'Active (Running)' : 'Stopped'}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-4 flex-wrap">
                <span>Core DHCPv4 engine</span>
                {dhcp4.pid && <span>PID: <strong className="font-mono text-slate-700 dark:text-slate-300">{dhcp4.pid}</strong></span>}
                {dhcp4.since && <span>Uptime: {new Date(dhcp4.since).toLocaleString()}</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn btn-primary text-xs py-1.5 px-3"
              onClick={() => handleAction('restart', 'dhcp4')}
              disabled={actionLoading}
            >
              <RotateCw size={13} className={actionLoading ? 'animate-spin' : ''} />
              Restart
            </button>
            {dhcp4.active ? (
              <button
                className="btn btn-danger text-xs py-1.5 px-3"
                onClick={() => handleAction('stop', 'dhcp4')}
                disabled={actionLoading}
              >
                <Power size={13} /> Stop
              </button>
            ) : (
              <button
                className="btn btn-secondary text-xs py-1.5 px-3"
                onClick={() => handleAction('start', 'dhcp4')}
                disabled={actionLoading}
              >
                <Power size={13} className="text-emerald-500" /> Start
              </button>
            )}
          </div>
        </div>

        {/* Kea Control Agent Service Card */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border transition-colors ${
                ctrlAgent.active
                  ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
              }`}
            >
              <Radio size={24} />
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap mb-1">
                <span className="font-mono font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  {ctrlAgent.service || 'kea-ctrl-agent'}
                </span>
                <span className={`badge ${ctrlAgent.active ? 'badge-active' : 'badge-danger'}`}>
                  {ctrlAgent.active ? 'Active (Running)' : 'Stopped'}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-4 flex-wrap">
                <span>REST Control Agent (Port 8000)</span>
                {ctrlAgent.pid && <span>PID: <strong className="font-mono text-slate-700 dark:text-slate-300">{ctrlAgent.pid}</strong></span>}
                {ctrlAgent.since && <span>Uptime: {new Date(ctrlAgent.since).toLocaleString()}</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn btn-primary text-xs py-1.5 px-3"
              onClick={() => handleAction('restart', 'ctrl-agent')}
              disabled={actionLoading}
            >
              <RotateCw size={13} className={actionLoading ? 'animate-spin' : ''} />
              Restart
            </button>
            {ctrlAgent.active ? (
              <button
                className="btn btn-danger text-xs py-1.5 px-3"
                onClick={() => handleAction('stop', 'ctrl-agent')}
                disabled={actionLoading}
              >
                <Power size={13} /> Stop
              </button>
            ) : (
              <button
                className="btn btn-secondary text-xs py-1.5 px-3"
                onClick={() => handleAction('start', 'ctrl-agent')}
                disabled={actionLoading}
              >
                <Power size={13} className="text-emerald-500" /> Start
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Global Kea DHCPv4 Configuration Form */}
      <form onSubmit={handleSaveSettings} className="glass-card space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <Sliders size={20} className="text-indigo-500" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Global Kea DHCP Parameters
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Applied to /etc/kea/kea-dhcp4.conf and runtime via Control Agent
              </p>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary text-xs sm:text-sm shadow-glow-indigo"
            disabled={savingSettings || settingsLoading}
          >
            <Save size={16} />
            {savingSettings ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {/* Global Timers */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock size={16} className="text-indigo-500" />
            Lease Timers & Lifetimes (Seconds)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="form-group mb-0">
              <label className="form-label">Valid Lifetime (valid-lifetime)</label>
              <input
                type="number"
                className="input-text font-mono"
                value={settings.defaultLeaseTime || 4000}
                onChange={(e) => setSettings({ ...settings, defaultLeaseTime: parseInt(e.target.value, 10) || 0 })}
                required
              />
              <span className="text-[11px] text-slate-400">Total expiration duration (default: 4000s)</span>
            </div>

            <div className="form-group mb-0">
              <label className="form-label">Renew Timer (renew-timer / T1)</label>
              <input
                type="number"
                className="input-text font-mono"
                value={settings.renewTimer || 1000}
                onChange={(e) => setSettings({ ...settings, renewTimer: parseInt(e.target.value, 10) || 0 })}
                required
              />
              <span className="text-[11px] text-slate-400">Client renews lease with server (default: 1000s)</span>
            </div>

            <div className="form-group mb-0">
              <label className="form-label">Rebind Timer (rebind-timer / T2)</label>
              <input
                type="number"
                className="input-text font-mono"
                value={settings.rebindTimer || 2000}
                onChange={(e) => setSettings({ ...settings, rebindTimer: parseInt(e.target.value, 10) || 0 })}
                required
              />
              <span className="text-[11px] text-slate-400">Client broadcasts to any server (default: 2000s)</span>
            </div>
          </div>
        </div>

        {/* Global Network Options */}
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Globe size={16} className="text-cyan-500" />
            Global DHCP Options
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group mb-0">
              <label className="form-label">Global DNS Name Servers</label>
              <input
                type="text"
                className="input-text font-mono"
                placeholder="8.8.8.8, 1.1.1.1"
                value={settings.domainNameServers || ''}
                onChange={(e) => setSettings({ ...settings, domainNameServers: e.target.value })}
              />
            </div>

            <div className="form-group mb-0">
              <label className="form-label">Global Domain Name</label>
              <input
                type="text"
                className="input-text"
                placeholder="corp.local"
                value={settings.domainName || ''}
                onChange={(e) => setSettings({ ...settings, domainName: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Authority Switch */}
        <div className="pt-2">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              className="checkbox-custom"
              checked={Boolean(settings.authoritative)}
              onChange={(e) => setSettings({ ...settings, authoritative: e.target.checked })}
            />
            <div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">Authoritative Server</span>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Send DHCPNAK to misconfigured clients requesting wrong addresses
              </p>
            </div>
          </label>
        </div>
      </form>

      {/* Section 3: Kea File Paths & Architecture Info */}
      <div className="glass-card space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200/80 dark:border-white/10">
          <FileCode size={20} className="text-indigo-500" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Kea Configuration & Storage Architecture
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <div className="text-slate-400 font-sans text-[11px] mb-1">Kea DHCP4 Config</div>
            <div className="text-indigo-600 dark:text-indigo-400 font-bold truncate">/etc/kea/kea-dhcp4.conf</div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <div className="text-slate-400 font-sans text-[11px] mb-1">Control Agent Config</div>
            <div className="text-cyan-600 dark:text-cyan-400 font-bold truncate">/etc/kea/kea-ctrl-agent.conf</div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <div className="text-slate-400 font-sans text-[11px] mb-1">Memfile CSV Leases</div>
            <div className="text-emerald-600 dark:text-emerald-400 font-bold truncate">/var/lib/kea/kea-leases4.csv</div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        onConfirm={runAction}
        title="Confirm Service Operation"
        message={`Are you sure you want to execute '${pendingAction?.action}' on ${pendingAction?.target}?`}
        confirmText="Confirm"
        loading={actionLoading}
      />
    </div>
  );
}
