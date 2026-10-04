import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Plus, Edit2, Trash2, BookmarkCheck, Search, Copy, Check, RefreshCw, Network } from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';

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

export function StaticIP({ setNotification }) {
  const { apiFetch } = useAuth();
  const [hosts, setHosts] = useState([]);
  const [scopes, setScopes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);
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
      setNotification({ type: 'danger', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHostsAndScopes();
  }, []);

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      const res = await apiFetch(`/api/static-hosts/${encodeURIComponent(deleteTarget.name)}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      setNotification({ type: 'success', message: `Host '${deleteTarget.name}' reservation deleted` });
      setDeleteTarget(null);
      fetchHostsAndScopes();
    } catch (err) {
      setNotification({ type: 'danger', message: err.message });
    } finally {
      setDeleting(false);
    }
  };

  const filteredHosts = hosts.filter((h) => {
    const q = search.toLowerCase();
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

  return (
    <div className="page-wrapper page-fill">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-1">
            Static IP Reservations
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Bind MAC physical addresses to dedicated fixed IP allocations
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button className="btn btn-secondary text-xs sm:text-sm" onClick={fetchHostsAndScopes}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Link to="/static-hosts/add" className="btn btn-primary text-xs sm:text-sm">
            <Plus size={16} />
            Add Static Host
          </Link>
        </div>
      </div>

      {/* Search & Stats Bar */}
      <div className="glass-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5">
        <div className="relative flex-1 max-w-md w-full">
          <input
            type="text"
            className="input-text pl-10 text-xs sm:text-sm"
            placeholder="Search by Hostname, MAC, IP, or Scope Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search
            size={17}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
          />
        </div>

        <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Showing <strong className="text-slate-900 dark:text-white">{filteredHosts.length}</strong> of{' '}
          <strong className="text-slate-900 dark:text-white">{hosts.length}</strong> reservations
        </div>
      </div>

      {/* Table */}
      <div className="glass-card table-card">
        <div className="table-container border-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>Host Identifier</th>
                <th>Scope Name</th>
                <th>MAC Address</th>
                <th>Fixed IP Address</th>
                <th>Description / Purpose</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredHosts.map((h) => {
                const scope = findMatchingScope(h.ip, scopes);
                return (
                  <tr key={h.name}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <BookmarkCheck size={16} />
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-white">{h.name}</span>
                      </div>
                    </td>

                    <td>
                      {scope ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-500/20">
                          <Network size={12} />
                          {scope.name || scope.subnet}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>

                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
                          {h.mac}
                        </span>
                        <button
                          className="btn-icon p-1"
                          onClick={() => handleCopy(h.mac, `mac-${h.name}`)}
                          title="Copy MAC"
                        >
                          {copiedKey === `mac-${h.name}` ? (
                            <Check size={13} className="text-emerald-500" />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                      </div>
                    </td>

                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400 text-xs sm:text-sm">
                          {h.ip}
                        </span>
                        <button
                          className="btn-icon p-1"
                          onClick={() => handleCopy(h.ip, `ip-${h.name}`)}
                          title="Copy IP"
                        >
                          {copiedKey === `ip-${h.name}` ? (
                            <Check size={13} className="text-emerald-500" />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xs truncate">
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

              {filteredHosts.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-500 dark:text-slate-400">
                    {search && (
                      <button className="btn btn-secondary text-xs mb-2" onClick={() => setSearch('')}>Clear filter</button>
                    )}
                    <div />
                    No static host reservations match your query
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
        title="Delete Host Reservation"
        message={`Are you sure you want to delete static host reservation '${deleteTarget?.name}' (${deleteTarget?.ip})? This action cannot be undone.`}
        confirmText="Delete Reservation"
        loading={deleting}
        loadingText="Deleting..."
        danger={true}
      />
    </div>
  );
}
