import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { ConfirmModal } from '../components/ConfirmModal';
import { Pagination } from '../components/Pagination';
import { ActionDropdown } from '../components/ActionDropdown';
import { SortableTh, EmptyState, CopyText } from '../components/TableParts';
import { usePersistedState } from '../hooks/usePersistedState';
import { useSortableData } from '../hooks/useSortableData';
import {
  Wifi,
  Search,
  RefreshCw,
  Download,
  Clock,
  RotateCcw,
  Bookmark,
  BookmarkPlus,
  X,
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

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'reserved', label: 'Reserved' },
  { id: 'expired', label: 'Expired' },
  { id: 'declined', label: 'Declined' }
];

const SORT_COLUMNS = {
  ip: { get: (l) => l.ip, type: 'ip' },
  mac: { get: (l) => l.mac, type: 'string' },
  hostname: { get: (l) => l.hostname, type: 'string' },
  status: { get: (l) => l.status, type: 'string' },
  starts: { get: (l) => l.starts, type: 'date' },
  ends: { get: (l) => l.ends, type: 'date' }
};

export function Leases({ setNotification }) {
  const { apiFetch } = useAuth();
  const [leases, setLeases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = usePersistedState('leases.search', '');
  const [statusFilter, setStatusFilter] = usePersistedState('leases.status', 'all');
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = usePersistedState('leases.pageSize', 25);

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
      // Conflicting leases are shown as normal active leases
      setLeases(
        (data.leases || []).map((l) =>
          l.status === 'conflict' ? { ...l, status: 'active', isConflict: false } : l
        )
      );
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

    const interval = setInterval(fetchLeases, 5000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchLeases();
  };

  const { sorted: sortedLeases, sort, toggleSort } = useSortableData(leases, SORT_COLUMNS);

  const paginatedLeases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedLeases.slice(start, start + pageSize);
  }, [sortedLeases, currentPage, pageSize]);

  const isFiltering = statusFilter !== 'all' || Boolean(search);
  const clearFilters = () => {
    setStatusFilter('all');
    setSearch('');
    setCurrentPage(1);
  };

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

    try {
      setReserving(true);
      const res = await apiFetch(`/api/leases/${reserveTarget.ip}/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mac: reserveTarget.mac,
          hostname: reserveHostname.trim(),
          subnetId: reserveSubnetId
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
        <span className="badge badge-danger" title="Client declined this IP">
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

  const sortProps = { sort, onSort: toggleSort };

  return (
    <div className="page-wrapper page-fill">
      {/* Header + single-row toolbar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            DHCP IP Leases
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm truncate">
            Live records of active IP assignments and static host reservations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="segmented-tabs overflow-x-auto">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`segmented-tab-btn ${statusFilter === tab.id ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearchSubmit} className="relative w-64">
            <input
              type="text"
              className="input-text pl-9 pr-8 py-2 text-xs sm:text-sm"
              placeholder="Search IP, MAC, hostname..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            {search && (
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                onClick={() => {
                  setSearch('');
                  setTimeout(fetchLeases, 0);
                }}
              >
                <X size={14} />
              </button>
            )}
          </form>

          <button className="btn btn-secondary text-xs py-2" onClick={exportCSV} title="Export CSV">
            <Download size={14} />
            CSV
          </button>
        </div>
      </div>

      {/* Leases Table (fills remaining height) */}
      <div className="glass-card table-card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <SortableTh label="Assigned IP" sortKey="ip" {...sortProps} />
                <SortableTh label="Hardware MAC" sortKey="mac" {...sortProps} />
                <SortableTh label="Client Hostname" sortKey="hostname" {...sortProps} />
                <SortableTh label="Status" sortKey="status" {...sortProps} />
                <SortableTh label="Lease Start" sortKey="starts" {...sortProps} />
                <SortableTh label="End Lease" sortKey="ends" {...sortProps} />
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLeases.map((l) => (
                <tr key={`${l.ip}-${l.mac}`}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Wifi size={15} className="text-cyan-500 shrink-0" />
                      <CopyText
                        value={l.ip}
                        setNotification={setNotification}
                        className="font-mono font-bold text-slate-900 dark:text-white text-xs sm:text-sm"
                      />
                    </div>
                  </td>

                  <td>
                    <CopyText
                      value={l.mac}
                      setNotification={setNotification}
                      className="font-mono text-slate-600 dark:text-slate-400 text-xs sm:text-sm"
                    >
                      {l.mac || 'N/A'}
                    </CopyText>
                  </td>

                  <td className="font-medium text-slate-800 dark:text-slate-200">
                    {l.hostname ? l.hostname : <span className="text-slate-400 italic font-normal">—</span>}
                  </td>

                  <td>{renderStatusBadge(l)}</td>

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
                        !l.isReserved && {
                          label: 'Convert to Reserve',
                          icon: BookmarkPlus,
                          onClick: () => openReserveModal(l)
                        },
                        !l.isReserved && l.status === 'active' && {
                          label: 'Release Lease',
                          icon: RotateCcw,
                          danger: true,
                          onClick: () => setReleaseTarget(l.ip)
                        },
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
                <tr className="h-full">
                  <td colSpan="7" className="h-full p-0">
                    <EmptyState
                      icon={Wifi}
                      title={isFiltering ? 'No leases match the current filters' : 'No lease records yet'}
                      hint={isFiltering ? 'Try a different status or search keyword.' : 'Leases appear here as clients obtain IP addresses.'}
                      actions={
                        isFiltering ? (
                          <button className="btn btn-secondary text-xs" onClick={clearFilters}>
                            Clear filters
                          </button>
                        ) : (
                          <button className="btn btn-secondary text-xs" onClick={fetchLeases}>
                            <RefreshCw size={13} /> Refresh
                          </button>
                        )
                      }
                    />
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
        title="Release Lease"
        message={`Release the active lease for ${typeof releaseTarget === 'object' ? releaseTarget?.ip : releaseTarget}? The client will lose this address and must request a new one from the DHCP pool.`}
        confirmText="Release Lease"
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
                  Convert to Host Reservation
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

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Lock this IP address specifically to this client's hardware MAC address so it will always receive the exact same IP.
            </p>

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
                  className="btn btn-primary text-xs sm:text-sm gap-2"
                  disabled={reserving}
                >
                  {reserving ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Saving Reservation...
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
