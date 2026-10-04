import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ActionDropdown } from '../../components/ActionDropdown';
import {
  Plus,
  Edit2,
  Trash2,
  Network,
  RefreshCw,
  Search,
  X,
  Power,
  PowerOff
} from 'lucide-react';

const maskToCidr = (mask) => {
  const parts = (mask || '').split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  const bits = parts.map((n) => n.toString(2).padStart(8, '0')).join('');
  if (!/^1*0*$/.test(bits)) return null;
  const firstZero = bits.indexOf('0');
  return firstZero === -1 ? 32 : firstZero;
};

const getCidr = (s) => {
  const prefix = maskToCidr(s.netmask);
  return prefix === null ? '' : `${s.subnet}/${prefix}`;
};

export function Scopes({ setNotification }) {
  const { apiFetch } = useAuth();
  const navigate = useNavigate();
  const [scopes, setScopes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [disableTarget, setDisableTarget] = useState(null);
  const [disableLoading, setDisableLoading] = useState(false);

  const fetchScopes = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/scopes');
      const data = await res.json();
      setScopes(data);
    } catch (err) {
      setNotification({ type: 'danger', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScopes();
  }, []);

  const handleToggle = async (scope, { fromModal = false } = {}) => {
    try {
      if (fromModal) setDisableLoading(true);
      const res = await apiFetch(`/api/scopes/${scope.id || scope.subnet}/toggle`, {
        method: 'PATCH',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setNotification({
        type: 'success',
        message: `Scope ${scope.subnet} is now ${data.disabled ? 'Disabled' : 'Enabled'}`,
      });
      fetchScopes();
    } catch (err) {
      setNotification({ type: 'danger', message: err.message });
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

      setNotification({ type: 'success', message: `Scope ${deleteTarget.subnet} deleted successfully` });
      setDeleteTarget(null);
      fetchScopes();
    } catch (err) {
      setNotification({ type: 'danger', message: err.message });
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredScopes = scopes.filter((sub) => {
    const term = search.toLowerCase();
    return (
      sub.name?.toLowerCase().includes(term) ||
      getCidr(sub).includes(term) ||
      sub.subnet?.toLowerCase().includes(term) ||
      sub.netmask?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="page-wrapper page-fill">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-1">
            Scope Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Configure network scopes, IP allocation pools, gateways, and DNS resolvers
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            className="btn btn-secondary text-xs sm:text-sm"
            onClick={fetchScopes}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Link to="/scopes/add" className="btn btn-primary text-xs sm:text-sm">
            <Plus size={16} />
            Add Scope
          </Link>
        </div>
      </div>

      {/* Search & Statistics Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md w-full">
          <input
            type="text"
            className="input-text pl-9 pr-8 text-xs sm:text-sm py-2"
            placeholder="Filter scopes (name, IP, CIDR, netmask)..."
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
          Showing {filteredScopes.length} of {scopes.length} scopes
        </span>
      </div>

      {/* Scopes Table */}
      <div className="glass-card table-card shadow-sm">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-center w-16">No.</th>
                <th>Scope Name</th>
                <th>CIDR</th>
                <th>Pool Range</th>
                <th>Static Hosts</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredScopes.map((sub, index) => {
                const isConfigured = Boolean(sub.rangeStart && sub.rangeEnd);
                const isDisabled = Boolean(sub.disabled);
                const resCount = sub.reservations?.length || 0;

                return (
                  <tr key={sub.id || sub.subnet}>
                    {/* 1. No. */}
                    <td className="text-center font-mono text-xs text-slate-400 dark:text-slate-500">
                      {index + 1}
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

                    {/* 4. Action Dropdown */}
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
              })}

              {filteredScopes.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Network size={36} className="text-slate-400 opacity-60" />
                      <span className="font-medium text-sm">
                        {search ? `No scopes matching "${search}"` : 'No scopes configured'}
                      </span>
                      {search ? (
                        <button className="btn btn-secondary text-xs mt-1" onClick={() => setSearch('')}>Clear filter</button>
                      ) : (
                        <Link to="/scopes/add" className="btn btn-primary text-xs mt-1"><Plus size={14} /> Add Scope</Link>
                      )}
                      <span className="hidden">
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Scope"
        message={`Are you sure you want to delete Scope ${deleteTarget?.subnet}? This will erase its DHCP pool configuration permanently.`}
        confirmText="Delete Scope"
        loading={deleteLoading}
        loadingText="Deleting..."
      />

      {/* Disable Scope Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(disableTarget)}
        onClose={() => setDisableTarget(null)}
        onConfirm={() => handleToggle(disableTarget, { fromModal: true })}
        variant="warning"
        icon={PowerOff}
        title="Disable Scope"
        message={`Disable Scope ${disableTarget?.subnet}? Clients in this scope will stop receiving new IP addresses until it is enabled again.`}
        confirmText="Disable Scope"
        loadingText="Disabling..."
        loading={disableLoading}
      />
    </div>
  );
}
