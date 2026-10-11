import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Wifi,
  Network,
  Terminal,
  Activity,
  Settings,
  Layers,
  X,
  Server,
  ShieldCheck,
  Radio,
  LucideProps
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
}

interface NavGroup {
  groupName: string;
  items: {
    to: string;
    label: string;
    icon: React.ComponentType<LucideProps>;
    badge?: string;
    isActive: (pathname: string) => boolean;
  }[];
}

export function Sidebar({ isOpen, onClose, isCollapsed }: SidebarProps) {
  const location = useLocation();
  const { apiFetch } = useAuth();
  const [daemonActive, setDaemonActive] = useState<boolean | null>(null);

  // Background check for daemon status to show live sidebar heartbeat
  useEffect(() => {
    let mounted = true;
    const checkService = async () => {
      try {
        const res = await apiFetch('/api/service/status');
        if (res.ok && mounted) {
          const data = await res.json();
          const active = data?.dhcp4?.active ?? data?.active ?? true;
          setDaemonActive(active);
        }
      } catch {
        if (mounted) setDaemonActive(null);
      }
    };
    checkService();
    const timer = setInterval(checkService, 20000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [apiFetch]);

  const navGroups: NavGroup[] = [
    {
      groupName: 'OPERATIONS',
      items: [
        {
          to: '/',
          label: 'Dashboard',
          icon: LayoutDashboard,
          isActive: (p) => p === '/' || p === '/dashboard',
        },
        {
          to: '/scopes',
          label: 'Scopes & Pools',
          icon: Network,
          isActive: (p) => p.startsWith('/scopes') || p.startsWith('/subnets'),
        },
        {
          to: '/leases',
          label: 'Active Leases',
          icon: Wifi,
          isActive: (p) => p.startsWith('/leases'),
        },
      ],
    },
    {
      groupName: 'HIGH AVAILABILITY',
      items: [
        {
          to: '/cluster',
          label: 'Cluster & HA',
          icon: Layers,
          badge: 'HA',
          isActive: (p) => p.startsWith('/cluster'),
        },
      ],
    },
    {
      groupName: 'OBSERVABILITY & SYSTEM',
      items: [
        {
          to: '/logs',
          label: 'Service Logs',
          icon: Terminal,
          isActive: (p) => p.startsWith('/logs') || p.startsWith('/service'),
        },
        {
          to: '/settings',
          label: 'Settings',
          icon: Settings,
          isActive: (p) => p.startsWith('/settings'),
        },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-200"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed lg:sticky top-0 inset-y-0 left-0 z-50 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border-r border-slate-200/80 dark:border-white/[0.08] flex flex-col h-screen shrink-0 select-none transition-[width,transform] duration-300 ease-in-out ${
          isCollapsed ? 'w-64 lg:w-[76px]' : 'w-64 lg:w-64'
        } ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div
          className={`h-16 px-4 flex items-center ${
            isCollapsed ? 'lg:justify-center' : 'justify-between'
          } border-b border-slate-200/80 dark:border-white/[0.08] shrink-0 bg-slate-50/50 dark:bg-slate-900/40`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div
              className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-glow-indigo shrink-0"
              title="Kea DHCP Web Management"
            >
              <Activity size={22} className="relative z-10" />
              <div className="absolute inset-0 rounded-xl bg-indigo-400/20 animate-pulse pointer-events-none" />
            </div>

            <div className={`overflow-hidden transition-opacity duration-200 ${isCollapsed ? 'lg:hidden' : 'block'}`}>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white whitespace-nowrap leading-none">
                  Kea DHCP
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 uppercase">
                  UI
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tracking-wide block mt-0.5">
                Enterprise Console
              </span>
            </div>
          </div>

          {/* Close button for mobile drawer */}
          <button
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="p-3 flex-1 flex flex-col gap-4 overflow-y-auto overflow-x-hidden">
          {navGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="flex flex-col gap-1">
              {!isCollapsed && (
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider select-none">
                  {group.groupName}
                </div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item.isActive(location.pathname);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    title={isCollapsed ? item.label : undefined}
                    className={`group relative h-10 rounded-xl text-sm font-medium flex items-center transition-all duration-200 ${
                      isCollapsed
                        ? 'lg:w-11 lg:h-11 lg:justify-center lg:mx-auto w-full px-3 gap-3'
                        : 'w-full px-3 gap-3'
                    } ${
                      active
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold shadow-sm shadow-indigo-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {/* Active highlight glow dot */}
                    {active && (
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full bg-cyan-300 hidden lg:block" />
                    )}

                    <Icon
                      size={19}
                      className={`shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                        active
                          ? 'text-white'
                          : 'text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                      }`}
                    />

                    <span className={`whitespace-nowrap flex-1 truncate ${isCollapsed ? 'lg:hidden' : 'inline-block'}`}>
                      {item.label}
                    </span>

                    {item.badge && !isCollapsed && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer: Service Status Monitor Capsule */}
        <div className="p-3 border-t border-slate-200/80 dark:border-white/[0.08] shrink-0 bg-slate-50/40 dark:bg-slate-900/40">
          {!isCollapsed ? (
            <div className="rounded-xl p-2.5 bg-white dark:bg-black/40 border border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    daemonActive === false
                      ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                      : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse'
                  }`}
                />
                <div className="truncate">
                  <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight">
                    Kea DHCPv4
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                    {daemonActive === false ? 'Offline / Warning' : 'Engine Running'}
                  </div>
                </div>
              </div>

              <div className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 shrink-0">
                REST CA
              </div>
            </div>
          ) : (
            <div
              className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10"
              title={`Kea DHCPv4: ${daemonActive === false ? 'Offline' : 'Online'}`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  daemonActive === false
                    ? 'bg-rose-500'
                    : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse'
                }`}
              />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
