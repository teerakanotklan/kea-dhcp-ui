import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ConfirmModal } from '../../components/ConfirmModal';
import {
  Network,
  Save,
  Plus,
  Trash2,
  Globe,
  SlidersHorizontal,
  BookmarkCheck,
  Server
} from 'lucide-react';

const PREDEFINED_DHCP_OPTIONS = [
  { value: 'ntp-servers', label: 'ntp-servers (NTP Time Server)', example: 'time.google.com, 192.168.1.1' },
  { value: 'bootfile-name', label: 'bootfile-name (PXE Boot File)', example: '"pxelinux.0" or "ipxe.efi"' },
  { value: 'tftp-server-name', label: 'tftp-server-name (TFTP Server)', example: '"tftp.corp.lan" or 192.168.1.5' },
  { value: 'next-server', label: 'next-server (PXE Server IP)', example: '192.168.1.5' },
  { value: 'domain-search', label: 'domain-search (Search Domains)', example: '"corp.lan", "sales.corp.lan"' },
  { value: 'interface-mtu', label: 'interface-mtu (MTU Size)', example: '1492' },
  { value: 'custom', label: 'Custom Option (Specify Name)...', example: 'value or "string"' },
];

export function ScopeForm({ setNotification }) {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { apiFetch } = useAuth();

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    subnet: '',
    netmask: '255.255.255.0',
    disabled: false,
    rangeStart: '',
    rangeEnd: '',
    routers: '',
    domainNameServers: '8.8.8.8, 1.1.1.1',
    domainName: '',
    defaultLeaseTime: 4000,
  });

  const [customOptions, setCustomOptions] = useState([]);
  const [reservations, setReservations] = useState([]);

  // New reservation inline state
  const [newRes, setNewRes] = useState({ hostname: '', mac: '', ip: '' });
  const [resAdding, setResAdding] = useState(false);
  const [deleteResTarget, setDeleteResTarget] = useState(null);

  const fetchScopeData = async () => {
    if (!isEdit) return;
    try {
      setLoading(true);
      const res = await apiFetch(`/api/scopes/${id}`);
      if (!res.ok) {
        throw new Error(`Scope #${id} not found`);
      }
      const found = await res.json();

      setFormData({
        name: found.name || '',
        subnet: found.subnet,
        netmask: found.netmask || '255.255.255.0',
        disabled: Boolean(found.disabled),
        rangeStart: found.rangeStart || '',
        rangeEnd: found.rangeEnd || '',
        routers: found.routers || '',
        domainNameServers: found.domainNameServers || '',
        domainName: found.domainName || '',
        defaultLeaseTime: found.defaultLeaseTime || 4000,
      });

      setReservations(found.reservations || []);

      if (Array.isArray(found.customOptions)) {
        const mapped = found.customOptions.map((opt) => {
          const isPredefined = PREDEFINED_DHCP_OPTIONS.some(
            (p) => p.value !== 'custom' && p.value === opt.name
          );
          return {
            type: isPredefined ? opt.name : 'custom',
            customName: isPredefined ? '' : opt.name,
            value: opt.value || '',
          };
        });
        setCustomOptions(mapped);
      }
    } catch (err) {
      setNotification({ type: 'danger', message: err.message });
      navigate('/scopes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScopeData();
  }, [id, isEdit]);

  const addCustomOption = (preset = null) => {
    setCustomOptions([
      ...customOptions,
      { type: preset || 'ntp-servers', customName: '', value: '' },
    ]);
  };

  const removeCustomOption = (index) => {
    setCustomOptions(customOptions.filter((_, i) => i !== index));
  };

  const handleOptionTypeChange = (index, newType) => {
    const updated = [...customOptions];
    updated[index].type = newType;
    if (newType !== 'custom') {
      updated[index].customName = '';
    }
    setCustomOptions(updated);
  };

  const handleOptionFieldChange = (index, field, val) => {
    const updated = [...customOptions];
    updated[index][field] = val;
    setCustomOptions(updated);
  };

  const handleAddReservation = async (e) => {
    e.preventDefault();
    if (!newRes.mac || !newRes.ip) {
      setNotification({ type: 'danger', message: 'MAC Address and IP Address are required' });
      return;
    }

    try {
      setResAdding(true);
      const res = await apiFetch(`/api/scopes/${id}/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hwAddress: newRes.mac,
          ipAddress: newRes.ip,
          hostname: newRes.hostname
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setNotification({ type: 'success', message: `Reservation for ${newRes.ip} added successfully` });
      setNewRes({ hostname: '', mac: '', ip: '' });
      await fetchScopeData();
    } catch (err) {
      setNotification({ type: 'danger', message: err.message });
    } finally {
      setResAdding(false);
    }
  };

  const handleDeleteReservation = async () => {
    if (!deleteResTarget) return;
    try {
      const res = await apiFetch(`/api/scopes/${id}/reservations/${deleteResTarget.mac}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setNotification({ type: 'success', message: `Reservation ${deleteResTarget.mac} deleted` });
      setDeleteResTarget(null);
      await fetchScopeData();
    } catch (err) {
      setNotification({ type: 'danger', message: err.message });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const formattedOptions = customOptions
      .map((opt) => {
        const optionName = opt.type === 'custom' ? opt.customName.trim() : opt.type;
        return {
          name: optionName,
          value: opt.value.trim(),
        };
      })
      .filter((opt) => opt.name && opt.value !== '');

    const payload = {
      ...formData,
      customOptions: formattedOptions,
    };

    try {
      if (isEdit) {
        const res = await apiFetch(`/api/scopes/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        setNotification({ type: 'success', message: `Scope ${formData.subnet} updated successfully` });
      } else {
        const res = await apiFetch('/api/scopes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        setNotification({ type: 'success', message: `Scope ${formData.subnet} created successfully` });
      }
      navigate('/scopes');
    } catch (err) {
      setNotification({ type: 'danger', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-wrapper max-w-7xl mx-auto flex items-center justify-center py-20">
        <div className="text-slate-500 dark:text-slate-400 font-medium animate-pulse">
          Loading Scope Details...
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {isEdit ? `Edit Scope ${formData.subnet || '#' + id}` : 'Create New Scope'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5">
            {isEdit
              ? 'Modify Kea subnet pools, options, and integrated host reservations'
              : 'Define a new Kea DHCPv4 subnet and dynamic IP pool'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            className="btn btn-secondary text-xs sm:text-sm"
            onClick={() => navigate('/scopes')}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary text-xs sm:text-sm shadow-glow-indigo"
            onClick={handleSubmit}
            disabled={saving}
          >
            <Save size={16} />
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Scope'}
          </button>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Network & Address Pool */}
        <div className="glass-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <Network size={20} className="text-indigo-500" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                1. Network Identification & IP Range
              </h2>
            </div>

            <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Scope Status:
              </span>
              <div
                onClick={() => setFormData((p) => ({ ...p, disabled: !p.disabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  !formData.disabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/20'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                    !formData.disabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </div>
              <span className={`text-xs font-bold ${!formData.disabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                {!formData.disabled ? 'Active (Enabled)' : 'Disabled'}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="form-group mb-0 sm:col-span-2">
              <label className="form-label">Scope Name *</label>
              <input
                type="text"
                className="input-text"
                placeholder="Office LAN"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                maxLength={64}
                required
              />
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Descriptive label for this Kea subnet
              </span>
            </div>

            <div className="form-group mb-0">
              <label className="form-label">Subnet Network IP or CIDR *</label>
              <input
                type="text"
                className="input-text font-mono"
                placeholder="192.168.1.0 or 192.168.1.0/24"
                value={formData.subnet}
                onChange={(e) => setFormData({ ...formData, subnet: e.target.value })}
                required
              />
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                The network IP address (e.g. 192.168.1.0)
              </span>
            </div>

            <div className="form-group mb-0">
              <label className="form-label">Subnet Mask *</label>
              <input
                type="text"
                className="input-text font-mono"
                placeholder="255.255.255.0"
                value={formData.netmask}
                onChange={(e) => setFormData({ ...formData, netmask: e.target.value })}
                required
              />
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Network mask prefix (e.g. 255.255.255.0 for /24)
              </span>
            </div>

            <div className="form-group mb-0">
              <label className="form-label">DHCP Pool Range Start</label>
              <input
                type="text"
                className="input-text font-mono"
                placeholder="192.168.1.100"
                value={formData.rangeStart}
                onChange={(e) => setFormData({ ...formData, rangeStart: e.target.value })}
              />
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                First dynamic assignable IP
              </span>
            </div>

            <div className="form-group mb-0">
              <label className="form-label">DHCP Pool Range End</label>
              <input
                type="text"
                className="input-text font-mono"
                placeholder="192.168.1.200"
                value={formData.rangeEnd}
                onChange={(e) => setFormData({ ...formData, rangeEnd: e.target.value })}
              />
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Last dynamic assignable IP
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Gateway, DNS & Timing Parameters */}
        <div className="glass-card space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200/80 dark:border-white/10">
            <Globe size={20} className="text-cyan-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              2. Gateway & Standard Network Parameters
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="form-group mb-0">
              <label className="form-label">Default Gateway (Routers)</label>
              <input
                type="text"
                className="input-text font-mono"
                placeholder="192.168.1.1"
                value={formData.routers}
                onChange={(e) => setFormData({ ...formData, routers: e.target.value })}
              />
            </div>

            <div className="form-group mb-0">
              <label className="form-label">DNS Name Servers</label>
              <input
                type="text"
                className="input-text font-mono"
                placeholder="8.8.8.8, 1.1.1.1"
                value={formData.domainNameServers}
                onChange={(e) => setFormData({ ...formData, domainNameServers: e.target.value })}
              />
            </div>

            <div className="form-group mb-0">
              <label className="form-label">Domain Name</label>
              <input
                type="text"
                className="input-text"
                placeholder="corp.internal"
                value={formData.domainName}
                onChange={(e) => setFormData({ ...formData, domainName: e.target.value })}
              />
            </div>

            <div className="form-group mb-0">
              <label className="form-label">Valid Lifetime (seconds)</label>
              <input
                type="number"
                className="input-text"
                placeholder="4000"
                value={formData.defaultLeaseTime}
                onChange={(e) => setFormData({ ...formData, defaultLeaseTime: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Additional DHCP Options */}
        <div className="glass-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <SlidersHorizontal size={20} className="text-indigo-500" />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  3. Additional DHCP Options
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Custom Kea option-data directives
                </p>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-secondary text-xs self-start sm:self-auto"
              onClick={() => addCustomOption()}
            >
              <Plus size={14} /> Add Option
            </button>
          </div>

          {customOptions.length > 0 ? (
            <div className="space-y-3 pt-2">
              {customOptions.map((opt, index) => {
                const isCustom = opt.type === 'custom';
                return (
                  <div
                    key={index}
                    className="inner-panel flex flex-col md:flex-row items-stretch md:items-center gap-3 p-3.5"
                  >
                    <div className="w-full md:w-5/12">
                      <select
                        className="select-input text-xs sm:text-sm py-2"
                        value={opt.type}
                        onChange={(e) => handleOptionTypeChange(index, e.target.value)}
                      >
                        {PREDEFINED_DHCP_OPTIONS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {isCustom && (
                      <div className="w-full md:w-3/12">
                        <input
                          type="text"
                          className="input-text text-xs sm:text-sm py-2 font-mono"
                          placeholder="option-name"
                          value={opt.customName}
                          onChange={(e) => handleOptionFieldChange(index, 'customName', e.target.value)}
                          required
                        />
                      </div>
                    )}

                    <div className="flex-1">
                      <input
                        type="text"
                        className="input-text text-xs sm:text-sm py-2 font-mono"
                        placeholder="Option Value"
                        value={opt.value}
                        onChange={(e) => handleOptionFieldChange(index, 'value', e.target.value)}
                        required
                      />
                    </div>

                    <button
                      type="button"
                      className="btn-icon text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 shrink-0 self-end md:self-center"
                      onClick={() => removeCustomOption(index)}
                      title="Remove option"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-white/10 rounded-xl">
              No additional options configured.
            </div>
          )}
        </div>

        {/* Section 4: Integrated Static Host Reservations (Only in Edit mode) */}
        {isEdit && (
          <div className="glass-card space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <BookmarkCheck size={20} className="text-amber-500" />
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    4. Static Host Reservations (Integrated in Scope)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Kea native reservations (`reservations`) for fixed MAC-to-IP bindings within this subnet
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Add Reservation Inline Form */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                + Add New Host Reservation to this Scope
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  className="input-text text-xs"
                  placeholder="Hostname (e.g. printer-01)"
                  value={newRes.hostname}
                  onChange={(e) => setNewRes({ ...newRes, hostname: e.target.value })}
                />
                <input
                  type="text"
                  className="input-text text-xs font-mono"
                  placeholder="MAC Address (e.g. 00:11:22:33:44:55)"
                  value={newRes.mac}
                  onChange={(e) => setNewRes({ ...newRes, mac: e.target.value })}
                />
                <input
                  type="text"
                  className="input-text text-xs font-mono"
                  placeholder={`Fixed IP (e.g. ${formData.subnet.split('.')[0]}.${formData.subnet.split('.')[1] || '168'}.${formData.subnet.split('.')[2] || '1'}.50)`}
                  value={newRes.ip}
                  onChange={(e) => setNewRes({ ...newRes, ip: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn-primary text-xs py-2"
                  onClick={handleAddReservation}
                  disabled={resAdding}
                >
                  <Plus size={14} />
                  {resAdding ? 'Adding...' : 'Add Reservation'}
                </button>
              </div>
            </div>

            {/* Reservations Table */}
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Hostname</th>
                    <th>MAC Address</th>
                    <th>Fixed IP Address</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.length > 0 ? (
                    reservations.map((r, idx) => (
                      <tr key={idx}>
                        <td className="font-semibold text-sm text-slate-900 dark:text-white">
                          {r.hostname || r.name || '-'}
                        </td>
                        <td className="font-mono text-xs text-slate-600 dark:text-slate-400">
                          {r.mac}
                        </td>
                        <td className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          {r.ip}
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="btn-icon text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                            onClick={() => setDeleteResTarget(r)}
                            title="Delete Reservation"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-xs text-slate-400">
                        No static host reservations configured in this scope yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Submit Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={() => navigate('/scopes')}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary text-sm shadow-glow-indigo"
            disabled={saving}
          >
            <Save size={16} />
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Scope'}
          </button>
        </div>
      </form>

      {/* Delete Reservation Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteResTarget)}
        onClose={() => setDeleteResTarget(null)}
        onConfirm={handleDeleteReservation}
        title="Delete Reservation"
        message={`Are you sure you want to remove reservation for IP ${deleteResTarget?.ip} (${deleteResTarget?.mac})?`}
        confirmText="Remove Reservation"
      />
    </div>
  );
}
