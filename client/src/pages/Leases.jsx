import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { ConfirmModal } from '../components/ConfirmModal';
import { Pagination } from '../components/Pagination';
import { ActionDropdown } from '../components/ActionDropdown';
import {
  Wifi,
  Search,
  RefreshCw,
  Download,
  Clock,
  RotateCcw,
  Bookmark,
  BookmarkPlus,
  Calendar,
  X,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Network,
  Copy
} from 'lucide-react';

const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return '—';
  }
};

export function Leases({ setNotification }) {
  const { apiFetch } = useAuth();
  const [leases, setLeases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Release state
  const [releaseTarget, setReleaseTarget] = useState(null);
  const [releasing, setReleasing] = useState(false);

  // Convert to Reserve state & Modal
  const [reserveTarget, setReserveTarget] = useState(null);
  const [reserveHostname, setReserveHostname] = useState('');
  const [reserveSubnetId, setReserveSubnetId] = useState('');
  const [scopes, setScopes] = useState([]);
  const [reserving, setReserving] = useState(false);

  const fetchLeases = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (statusFilter !== 'all') query.append('status', statusFilter);
      if (search) query.append('search', search);

      const res = await apiFetch(`/api/leases?${query.toString()}`);
      const data = await res.json();
      setLeases(data.leases || []);
    } catch (err) {
      if (setNotification) setNotification({ type: 'danger', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchScopes = async () => {
    try {
      const res = await apiFetch('/api/scopes');
      const data = await res.json();
      setScopes(Array.isArray(data) ? data : []);
    } catch (err) {
      // Scopes fetch failed non-blocking
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchLeases();
    fetchScopes();
  }, [statusFilter]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLeases, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, statusFilter, search]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchLeases();
  };

  const paginatedLeases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return leases.slice(start, start + pageSize);
  }, [leases, currentPage, pageSize]);

  const confirmRelease = async () => {
    if (!releaseTarget) return;
    const ip = typeof releaseTarget === 'object' ? releaseTarget.ip : releaseTarget;

    try {
      setReleasing(true);
      const res = await apiFetch(`/api/leases/${ip}/release`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (setNotification) setNotification({ type: 'success', message: data.message });
      fetchLeases();
    } catch (err) {
      if (setNotification) setNotification({ type: 'danger', message: err.message });
    } finally {
      setReleasing(false);
      setReleaseTarget(null);
    }
  };

  // Open Convert to Reserve modal
  const openReserveModal = (lease) => {
    setReserveTarget(lease);
    setReserveHostname(lease.hostname || '');
    setReserveSubnetId(String(lease.subnetId || ''));
  };

  // Confirm Convert to Reserve
  const handleConfirmReservation = async (e) => {
    e.preventDefault();
    if (!reserveTarget) return;

    const isConflict = Boolean(reserveTarget.isConflict || reserveTarget.conflictInfo);

    try {
      setReserving(true);
      const res = await apiFetch(`/api/leases/${reserveTarget.ip}/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mac: reserveTarget.mac,
          hostname: reserveHostname.trim(),
          subnetId: reserveSubnetId,
          overwrite: isConflict
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create reservation');

      if (setNotification) {
        setNotification({
          type: 'success',
          message: data.message || `IP ${reserveTarget.ip} converted to static reservation successfully!`
        });
      }

      setReserveTarget(null);
      fetchLeases();
    } catch (err) {
      if (setNotification) setNotification({ type: 'danger', message: err.message });
    } finally {
      setReserving(false);
    }
  };

  const exportCSV = () => {
    if (leases.length === 0) return;

    const headers = ['IP Address', 'MAC Address', 'Hostname', 'Status', 'Lease Start', 'End Lease'];
    const rows = leases.map(l => [
      l.ip,
      l.mac || '',
      `"${l.hostname || ''}"`,
      l.status,
      formatDateTime(l.starts),
      l.isReserved ? 'Never (Reserved)' : formatDateTime(l.ends)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `dhcp_leases_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderStatusBadge = (lease) => {
    const st = lease.status || 'active';
    if (st === 'conflict' || lease.isConflict) {
      return (
        <span
          className="badge badge-conflict"
          title={`IP is reserved for MAC: ${lease.conflictInfo?.reservedForMac || 'another host'}`}
        >
          <AlertTriangle size={11} className="shrink-0" />
          <span>Conflict</span>
        </span>
      );
    }
    if (st === 'reserved' || lease.isReserved) {
      return (
        <span className="badge badge-purple" title="Static Host Reservation (Strict Match)">
          <Bookmark size={11} className="shrink-0" />
          <span>Reserved</span>
        </span>
      );
    }
    if (st === 'active') {
      return (
        <span className="badge badge-active" title="Valid active lease">
          <span className="pulse-dot" />
          <span>Active</span>
        </span>
      );
    }
    if (st === 'expired') {
      return (
        <span className="badge badge-warning" title="Lease duration has expired">
          <span>Expired</span>
        </span>
      );
    }
    if (st === 'declined') {
      return (
        <span className="badge badge-danger" title="Client declined IP (conflict detected)">
          <span>Declined</span>
        </span>
      );
    }
    return (
      <span className="badge badge-info">
        <span className="capitalize">{st}</span>
      </span>
    );
  };

  return (
    <div className="page-wrapper space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-1">
            DHCP IP Leases
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Live records of active IP assignments and static host reservations granted to network clients
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <button
            className={`btn text-xs sm:text-sm ${autoRefresh ? 'btn-cyan' : 'btn-secondary'}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title="Auto refresh every 10 seconds"
          >
            <Clock size={15} />
            {autoRefresh ? 'Auto (10s): ON' : 'Auto-Refresh'}
          </button>
          <button className="btn btn-secondary text-xs sm:text-sm" onClick={exportCSV}>
            <Download size={15} />
            Export CSV
          </button>
          <button className="btn btn-secondary text-xs sm:text-sm" onClick={fetchLeases} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-card flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-5">
        {/* Status Tabs */}
        <div className="segmented-tabs overflow-x-auto self-start md:self-auto">
          {[
            { id: 'all', label: 'All' },
            { id: 'active', label: 'Active' },
            { id: 'reserved', label: 'Reserved' },
            { id: 'conflict', label: 'Conflict' },
            { id: 'expired', label: 'Expired' },
            { id: 'declined', label: 'Declined' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`segmented-tab-btn ${statusFilter === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-md w-full">
          <div className="relative flex-1">
            <input
              type="text"
              className="input-text pl-10 text-xs sm:text-sm"
              placeholder="Search IP, MAC, hostname..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            />
          </div>
          <button type="submit" className="btn btn-secondary text-xs sm:text-sm shrink-0">
            Search
          </button>
        </form>
      </div>

      {/* Leases Table */}
      <div className="glass-card p-0 overflow-hidden">
        <div className="table-container border-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>Assigned IP</th>
                <th>Hardware MAC</th>
                <th>Client Hostname</th>
                <th>Status</th>
                <th>Lease Start</th>
                <th>End Lease</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLeases.map((l) => (
                <tr key={`${l.ip}-${l.mac}`} className={l.status === 'conflict' ? 'bg-amber-500/[0.04]' : ''}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Wifi size={15} className="text-cyan-500 shrink-0" />
                      <div>
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                          {l.ip}
                        </span>
                        {l.status === 'conflict' && l.conflictInfo && (
                          <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                            Reserved for: {l.conflictInfo.reservedForHostname || l.conflictInfo.reservedForMac}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td>
                    <span className="font-mono text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
                      {l.mac || 'N/A'}
                    </span>
                  </td>

                  <td className="font-medium text-slate-800 dark:text-slate-200">
                    {l.hostname ? l.hostname : <span className="text-slate-400 italic font-normal">—</span>}
                  </td>

                  <td>
                    {renderStatusBadge(l)}
                  </td>

                  <td className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                    {formatDateTime(l.starts)}
                  </td>

                  <td className="text-xs font-mono">
                    {l.isReserved || l.status === 'reserved' ? (
                      <span className="text-indigo-600 dark:text-indigo-400 font-medium">Never (Reserved)</span>
                    ) : (
                      <span className="text-slate-600 dark:text-slate-300">{formatDateTime(l.ends)}</span>
                    )}
                  </td>

                  {/* Action Dropdown */}
                  <td className="text-right">
                    <ActionDropdown
                      items={[
                        // 1. Conflict actions
                        l.status === 'conflict' && {
                          label: 'Force Release IP',
                          icon: ShieldAlert,
                          danger: true,
                          onClick: () => setReleaseTarget(l)
                        },
                        l.status === 'conflict' && {
                          label: 'Overwrite & Reserve',
                          icon: BookmarkPlus,
                          onClick: () => openReserveModal(l)
                        },

                        // 2. Normal reservation conversion
                        !l.isReserved && l.status !== 'conflict' && {
                          label: 'Convert to Reserve',
                          icon: BookmarkPlus,
                          onClick: () => openReserveModal(l)
                        },

                        // 3. Normal release action
                        !l.isReserved && l.status === 'active' && {
                          label: 'Release Lease',
                          icon: RotateCcw,
                          danger: true,
                          onClick: () => setReleaseTarget(l.ip)
                        },

                        // Separator & Utility actions
                        { separator: true },
                        {
                          label: 'Copy IP Address',
                          icon: Copy,
                          onClick: () => {
                            navigator.clipboard.writeText(l.ip);
                            if (setNotification) setNotification({ type: 'success', message: `Copied ${l.ip}` });
                          }
                        },
                        l.mac && {
                          label: 'Copy MAC Address',
                          icon: Copy,
                          onClick: () => {
                            navigator.clipboard.writeText(l.mac);
                            if (setNotification) setNotification({ type: 'success', message: `Copied ${l.mac}` });
                          }
                        }
                      ]}
                    />
                  </td>
                </tr>
              ))}

              {leases.length === 0 && !loading && (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-500 dark:text-slate-400">
                    No lease records matching the current criteria
                  </td>
                </tr>
              )}

              {loading && leases.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading IP leases...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalItems={leases.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      </div>

      {/* Release Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(releaseTarget)}
        onClose={() => setReleaseTarget(null)}
        onConfirm={confirmRelease}
        variant="danger"
        icon={RotateCcw}
        title={releaseTarget && typeof releaseTarget === 'object' && releaseTarget.status === 'conflict' ? 'Force Release Conflicted Lease' : 'Release Lease'}
        message={
          releaseTarget && typeof releaseTarget === 'object' && releaseTarget.status === 'conflict'
            ? `Force release the lease for ${releaseTarget.ip}? This removes the active lease from Kea runtime so the reserved device (${releaseTarget.conflictInfo?.reservedForMac}) can claim this IP immediately.`
            : `Release the active lease for ${typeof releaseTarget === 'object' ? releaseTarget?.ip : releaseTarget}? The client will lose this address and must request a new one from the DHCP pool.`
        }
        confirmText={releaseTarget && typeof releaseTarget === 'object' && releaseTarget.status === 'conflict' ? 'Force Release IP' : 'Release Lease'}
        loadingText="Releasing..."
        loading={releasing}
      />

      {/* Convert to Reserve Modal */}
      {Boolean(reserveTarget) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scale-up border-indigo-500/30">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
                <BookmarkPlus size={22} />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {reserveTarget.status === 'conflict' || reserveTarget.conflictInfo
                    ? 'Overwrite & Reserve IP'
                    : 'Convert to Host Reservation'}
                </h3>
              </div>
              <button
                type="button"
                className="btn-icon text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                onClick={() => setReserveTarget(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Conflict / Overwrite Warning Banner */}
            {(reserveTarget.status === 'conflict' || reserveTarget.conflictInfo) ? (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <AlertTriangle size={15} />
                  <span>Reservation Overwrite & Force Release</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                  IP <strong>{reserveTarget.ip}</strong> is currently reserved for{' '}
                  <strong>{reserveTarget.conflictInfo?.reservedForHostname || reserveTarget.conflictInfo?.reservedForMac}</strong>.
                  Confirming will overwrite the reservation for this client (<strong>{reserveTarget.mac}</strong>) and force-release the old lease so the previous owner receives a new IP from the pool.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Lock this IP address specifically to this client's hardware MAC address so it will always receive the exact same IP.
              </p>
            )}

            <form onSubmit={handleConfirmReservation} className="space-y-4">
              {/* Readonly IP & MAC row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="inner-panel space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    IP Address
                  </span>
                  <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                    {reserveTarget.ip}
                  </div>
                </div>

                <div className="inner-panel space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Hardware MAC
                  </span>
                  <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                    {reserveTarget.mac}
                  </div>
                </div>
              </div>

              {/* Hostname Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Device Hostname / Reservation Name
                </label>
                <input
                  type="text"
                  className="input-text text-sm"
                  placeholder="e.g. client1 or printer-office"
                  value={reserveHostname}
                  onChange={(e) => setReserveHostname(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Scope / Subnet Selector */}
              {scopes.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Target Scope / Subnet
                  </label>
                  <select
                    className="select-input text-sm"
                    value={reserveSubnetId}
                    onChange={(e) => setReserveSubnetId(e.target.value)}
                  >
                    {scopes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.subnetCidr || s.subnet})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  className="btn btn-secondary text-xs sm:text-sm"
                  onClick={() => setReserveTarget(null)}
                  disabled={reserving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn text-xs sm:text-sm gap-2 ${
                    reserveTarget.status === 'conflict' || reserveTarget.conflictInfo
                      ? 'btn-danger'
                      : 'btn-primary'
                  }`}
                  disabled={reserving}
                >
                  {reserving ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Saving Reservation...
                    </>
                  ) : reserveTarget.status === 'conflict' || reserveTarget.conflictInfo ? (
                    <>
                      <AlertTriangle size={14} />
                      Overwrite & Force Reserve
                    </>
                  ) : (
                    <>
                      <Bookmark size={14} />
                      Confirm & Reserve
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
