import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ActionDropdown } from '../../components/ActionDropdown';
import { Pagination } from '../../components/Pagination';
import { SortableTh, EmptyState, EmptyStateRow, TableSkeleton } from '../../components/TableParts';
import { usePersistedState } from '../../hooks/usePersistedState';
import { useSortableData } from '../../hooks/useSortableData';
import {
  Plus,
  Search,
  Network,
  Power,
  PowerOff,
  Edit2,
  Trash2,
  X
} from 'lucide-react';

const getCidr = (sub) => {
  if (sub.subnetCidr) return sub.subnetCidr;
  if (!sub.subnet) return '';
  if (sub.netmask) {
    const maskMap = {
      '255.255.255.0': '/24',
      '255.255.0.0': '/16',
      '255.0.0.0': '/8',
      '255.255.255.128': '/25',
      '255.255.255.192': '/26',
      '255.255.255.224': '/27',
      '255.255.255.240': '/28',
      '255.255.255.248': '/29',
      '255.255.255.252': '/30',
    };
    return `${sub.subnet}${maskMap[sub.netmask] || ''}`;
  }
  return sub.subnet;
};

const SORT_COLUMNS = {
  name: { get: (s) => s.name || '', type: 'string' },
  cidr: { get: (s) => s.subnetCidr || getCidr(s), type: 'string' },
  range: { get: (s) => s.rangeStart || '', type: 'ip' },
  resCount: { get: (s) => s.reservations?.length || 0, type: 'number' },
  status: { get: (s) => (s.disabled ? 'disabled' : s.rangeStart ? 'active' : 'static'), type: 'string' }
};

export function Scopes({ setNotification }) {
  const { apiFetch } = useAuth();
  const navigate = useNavigate();
  const [scopes, setScopes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = usePersistedState('scopes.search', '');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = usePersistedState('scopes.pageSize', 25);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [disableTarget, setDisableTarget] = useState(null);
  const [disableLoading, setDisableLoading] = useState(false);

  const fetchScopes = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/scopes');
      const data = await res.json();
      setScopes(Array.isArray(data) ? data : []);
    } catch (err) {
      if (setNotification) setNotification({ type: 'danger', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScopes();
    const interval = setInterval(fetchScopes, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = async (scope, { fromModal = false } = {}) => {
    try {
      if (fromModal) setDisableLoading(true);
      const res = await apiFetch(`/api/scopes/${scope.id || scope.subnet}/toggle`, {
        method: 'PATCH',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (setNotification) {
        setNotification({
          type: 'success',
          message: `Scope ${scope.subnet} is now ${data.disabled ? 'Disabled' : 'Enabled'}`,
        });
      }
      fetchScopes();
    } catch (err) {
      if (setNotification) setNotification({ type: 'danger', message: err.message });
    } finally {
      if (fromModal) {
        setDisableLoading(false);
        setDisableTarget(null);
      }
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleteLoading(true);
      const res = await apiFetch(`/api/scopes/${deleteTarget.id || deleteTarget.subnet}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      if (setNotification) {
        setNotification({ type: 'success', message: `Scope ${deleteTarget.subnet} deleted successfully` });
      }
      setDeleteTarget(null);
      fetchScopes();
    } catch (err) {
      if (setNotification) setNotification({ type: 'danger', message: err.message });
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredScopes = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return scopes;
    return scopes.filter((sub) => {
      return (
        sub.name?.toLowerCase().includes(term) ||
        getCidr(sub).includes(term) ||
        sub.subnet?.toLowerCase().includes(term) ||
        sub.netmask?.toLowerCase().includes(term)
      );
    });
  }, [scopes, search]);

  const { sorted: sortedScopes, sort, toggleSort } = useSortableData(filteredScopes, SORT_COLUMNS);
  const sortProps = { sort, onSort: toggleSort };

  const paginatedScopes = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedScopes.slice(start, start + pageSize);
  }, [sortedScopes, currentPage, pageSize]);

  return (
    <div className="page-wrapper page-fill">
      {/* Header & Single-row Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-0.5">
            Scope Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
            Configure network scopes, IP allocation pools, gateways, and DNS resolvers
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link to="/scopes/add" className="btn btn-primary text-xs sm:text-sm">
            <Plus size={16} />
            Add Scope
          </Link>
        </div>
      </div>

      {/* Search Bar & Counter */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md w-full">
          <input
            type="text"
            className="input-text pl-9 pr-8 text-xs sm:text-sm py-2"
            placeholder="Filter scopes by name, IP, CIDR, or netmask..."
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

        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Showing <strong className="text-slate-800 dark:text-slate-200 font-mono">{filteredScopes.length}</strong> of{' '}
          <strong className="font-mono">{scopes.length}</strong> scopes
        </span>
      </div>

      {/* Scopes Table */}
      <div className="glass-card table-card shadow-sm">
        <div className="table-container">
          <table className={`data-table ${!loading && filteredScopes.length === 0 ? 'is-empty' : ''}`}>
            <thead>
              <tr>
                <th className="text-center w-14">No.</th>
                <SortableTh label="Scope Name" sortKey="name" {...sortProps} />
                <SortableTh label="CIDR" sortKey="cidr" {...sortProps} />
                <SortableTh label="Pool Range" sortKey="range" {...sortProps} />
                <SortableTh label="Static Hosts" sortKey="resCount" {...sortProps} />
                <SortableTh label="Status" sortKey="status" {...sortProps} />
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && scopes.length === 0 ? (
                <TableSkeleton rows={8} cols={7} />
              ) : (
                paginatedScopes.map((sub, index) => {
                const isConfigured = Boolean(sub.rangeStart && sub.rangeEnd);
                const isDisabled = Boolean(sub.disabled);
                const resCount = sub.reservations?.length || 0;
                const absoluteIndex = (currentPage - 1) * pageSize + index + 1;

                return (
                  <tr key={sub.id || sub.subnet}>
                    {/* No. */}
                    <td className="text-center font-mono text-xs text-slate-400 dark:text-slate-500">
                      {absoluteIndex}
                    </td>

                    {/* Scope Name */}
                    <td className={`font-semibold text-sm ${isDisabled ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                      {sub.name || <span className="text-slate-400">-</span>}
                    </td>

                    {/* CIDR */}
                    <td className="font-mono text-sm text-cyan-600 dark:text-cyan-400 font-bold">
                      {sub.subnetCidr || getCidr(sub) || <span className="text-slate-400">-</span>}
                    </td>

                    {/* Pool Range */}
                    <td className="font-mono text-xs text-slate-600 dark:text-slate-400">
                      {sub.rangeStart && sub.rangeEnd ? `${sub.rangeStart} - ${sub.rangeEnd}` : <span className="text-slate-400 italic">None</span>}
                    </td>

                    {/* Static Reservations */}
                    <td>
                      <Link
                        to={`/scopes/${sub.id || sub.subnet}/edit`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                      >
                        {resCount} reserved
                      </Link>
                    </td>

                    {/* Status */}
                    <td>
                      {isDisabled ? (
                        <span className="badge badge-danger">
                          Disabled
                        </span>
                      ) : isConfigured ? (
                        <span className="badge badge-active">
                          <span className="pulse-dot" />
                          Active
                        </span>
                      ) : (
                        <span className="badge badge-warning">
                          Static Only
                        </span>
                      )}
                    </td>

                    {/* Action Dropdown */}
                    <td className="text-right">
                      <ActionDropdown
                        items={[
                          {
                            label: 'Edit Scope',
                            icon: Edit2,
                            onClick: () => navigate(`/scopes/${sub.id || sub.subnet}/edit`)
                          },
                          {
                            label: isDisabled ? 'Enable Scope' : 'Disable Scope',
                            icon: isDisabled ? Power : PowerOff,
                            onClick: () => (isDisabled ? handleToggle(sub) : setDisableTarget(sub))
                          },
                          { separator: true },
                          {
                            label: 'Delete Scope',
                            icon: Trash2,
                            danger: true,
                            onClick: () => setDeleteTarget(sub)
                          }
                        ]}
                      />
                    </td>
                  </tr>
                );
              }))}

              {filteredScopes.length === 0 && !loading && (
                <EmptyStateRow
                  colSpan={7}
                  icon={Network}
                  title={search ? `No scopes matching "${search}"` : 'No scopes configured yet'}
                  hint={search ? 'Try searching for a different scope name or subnet CIDR.' : 'Create network scopes to manage dynamic IP allocation pools.'}
                  actions={
                    search ? (
                      <button className="btn btn-secondary text-xs" onClick={() => setSearch('')}>
                        Clear filter
                      </button>
                    ) : (
                      <Link to="/scopes/add" className="btn btn-primary text-xs">
                        <Plus size={14} /> Add Scope
                      </Link>
                    )
                  }
                />
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredScopes.length}
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
        title="Delete Scope"
        message={`Are you sure you want to delete scope "${deleteTarget?.name || deleteTarget?.subnet}"? This action cannot be undone.`}
        confirmText="Delete Scope"
        loading={deleteLoading}
      />

      {/* Disable Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(disableTarget)}
        onClose={() => setDisableTarget(null)}
        onConfirm={() => handleToggle(disableTarget, { fromModal: true })}
        title="Disable Scope"
        message={`Are you sure you want to disable scope "${disableTarget?.name || disableTarget?.subnet}"? Clients will no longer receive IP addresses from this scope.`}
        confirmText="Disable Scope"
        loading={disableLoading}
      />
    </div>
  );
}
