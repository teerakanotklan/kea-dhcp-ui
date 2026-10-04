import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Plus, Edit2, Trash2, BookmarkCheck, Search, Copy, Check, Network, X } from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Pagination } from '../../components/Pagination';
import { SortableTh, EmptyState, CopyText } from '../../components/TableParts';
import { usePersistedState } from '../../hooks/usePersistedState';
import { useSortableData } from '../../hooks/useSortableData';

const ipToLong = (ip) => {
  if (!ip) return 0;
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => isNaN(n) || n < 0 || n > 255)) return 0;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
};

const isIpInSubnet = (ip, subnet, netmask) => {
  if (!ip || !subnet || !netmask) return false;
  const ipL = ipToLong(ip);
  const subL = ipToLong(subnet);
  const maskL = ipToLong(netmask);
  if (!ipL || !subL || !maskL) return false;
  return (ipL & maskL) === (subL & maskL);
};

const findMatchingScope = (ip, scopes) => {
  if (!ip || !scopes || scopes.length === 0) return null;
  return scopes.find((s) => isIpInSubnet(ip, s.subnet, s.netmask));
};

const SORT_COLUMNS = {
  name: { get: (h) => h.name || '', type: 'string' },
  mac: { get: (h) => h.mac || '', type: 'string' },
  ip: { get: (h) => h.ip || '', type: 'ip' },
  description: { get: (h) => h.description || '', type: 'string' }
};

export function StaticIP({ setNotification }) {
  const { apiFetch } = useAuth();
  const [hosts, setHosts] = useState([]);
  const [scopes, setScopes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = usePersistedState('staticIP.search', '');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = usePersistedState('staticIP.pageSize', 25);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchHostsAndScopes = async () => {
    try {
      setLoading(true);
      const [resHosts, resScopes] = await Promise.all([
        apiFetch('/api/static-hosts'),
        apiFetch('/api/scopes')
      ]);
      const dataHosts = await resHosts.json();
      const dataScopes = await resScopes.json();
      setHosts(Array.isArray(dataHosts) ? dataHosts : []);
      setScopes(Array.isArray(dataScopes) ? dataScopes : []);
    } catch (err) {
      if (setNotification) setNotification({ type: 'danger', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHostsAndScopes();
    const interval = setInterval(fetchHostsAndScopes, 5000);
    return () => clearInterval(interval);
  }, []);

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      const res = await apiFetch(`/api/static-hosts/${encodeURIComponent(deleteTarget.name)}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      if (setNotification) {
        setNotification({ type: 'success', message: `Host '${deleteTarget.name}' reservation deleted` });
      }
      setDeleteTarget(null);
      fetchHostsAndScopes();
    } catch (err) {
      if (setNotification) setNotification({ type: 'danger', message: err.message });
    } finally {
      setDeleting(false);
    }
  };

  const filteredHosts = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return hosts;
    return hosts.filter((h) => {
      const scope = findMatchingScope(h.ip, scopes);
      const scopeName = scope?.name || scope?.subnet || '';
      return (
        h.name.toLowerCase().includes(q) ||
        h.mac.toLowerCase().includes(q) ||
        h.ip.includes(q) ||
        scopeName.toLowerCase().includes(q) ||
        (h.description && h.description.toLowerCase().includes(q))
      );
    });
  }, [hosts, scopes, search]);

  const { sorted: sortedHosts, sort, toggleSort } = useSortableData(filteredHosts, SORT_COLUMNS);
  const sortProps = { sort, onSort: toggleSort };

  const paginatedHosts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedHosts.slice(start, start + pageSize);
  }, [sortedHosts, currentPage, pageSize]);

  return (
    <div className="page-wrapper page-fill">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-0.5">
            Static IP Reservations
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
            Bind MAC physical addresses to dedicated fixed IP allocations
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link to="/static-hosts/add" className="btn btn-primary text-xs sm:text-sm">
            <Plus size={16} />
            Add Static Host
          </Link>
        </div>
      </div>

      {/* Search Bar & Stats */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md w-full">
          <input
            type="text"
            className="input-text pl-9 pr-8 text-xs sm:text-sm py-2"
            placeholder="Search Hostname, MAC, IP, or Scope..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400">
          Showing <strong className="text-slate-800 dark:text-slate-200 font-mono">{filteredHosts.length}</strong> of{' '}
          <strong className="font-mono">{hosts.length}</strong> reservations
        </div>
      </div>

      {/* Table */}
      <div className="glass-card table-card shadow-sm">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <SortableTh label="Host Identifier" sortKey="name" {...sortProps} />
                <th>Scope Name</th>
                <SortableTh label="MAC Address" sortKey="mac" {...sortProps} />
                <SortableTh label="Fixed IP Address" sortKey="ip" {...sortProps} />
                <SortableTh label="Description / Purpose" sortKey="description" {...sortProps} />
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedHosts.map((h) => {
                const scope = findMatchingScope(h.ip, scopes);
                return (
                  <tr key={h.name}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <BookmarkCheck size={15} />
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm">{h.name}</span>
                      </div>
                    </td>

                    <td>
                      {scope ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-500/20">
                          <Network size={12} />
                          {scope.name || scope.subnet}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>

                    <td>
                      <CopyText
                        value={h.mac}
                        setNotification={setNotification}
                        className="font-mono text-slate-600 dark:text-slate-400 text-xs sm:text-sm"
                      />
                    </td>

                    <td>
                      <CopyText
                        value={h.ip}
                        setNotification={setNotification}
                        className="font-mono font-bold text-cyan-600 dark:text-cyan-400 text-xs sm:text-sm"
                      />
                    </td>

                    <td className="text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {h.description || <span className="opacity-40">—</span>}
                    </td>

                    <td className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          to={`/static-hosts/${h.id || encodeURIComponent(h.name)}/edit`}
                          className="btn-icon"
                          title="Edit Host"
                        >
                          <Edit2 size={14} />
                        </Link>
                        <button
                          className="btn-icon text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                          onClick={() => setDeleteTarget(h)}
                          title="Delete Host"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredHosts.length === 0 && !loading && (
                <tr className="h-full">
                  <td colSpan="6" className="h-full p-0">
                    <EmptyState
                      icon={BookmarkCheck}
                      title={search ? `No static hosts matching "${search}"` : 'No static host reservations configured'}
                      hint={search ? 'Try searching for a different hostname, MAC, or IP address.' : 'Add static host entries to bind IP addresses permanently to client MAC addresses.'}
                      actions={
                        search ? (
                          <button className="btn btn-secondary text-xs" onClick={() => setSearch('')}>
                            Clear filter
                          </button>
                        ) : (
                          <Link to="/static-hosts/add" className="btn btn-primary text-xs">
                            <Plus size={14} /> Add Static Host
                          </Link>
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
          totalItems={filteredHosts.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Static Reservation"
        message={`Are you sure you want to delete static IP reservation '${deleteTarget?.name}' (${deleteTarget?.ip})?`}
        confirmText="Delete Reservation"
        loading={deleting}
      />
    </div>
  );
}
