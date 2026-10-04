import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Wifi,
  BookmarkCheck,
  Network,
  Terminal,
  Activity,
  Settings,
  X
} from 'lucide-react';

export function Sidebar({ isOpen, onClose }) {
  const location = useLocation();

  const navItems = [
    {
      to: '/',
      label: 'Dashboard',
      icon: LayoutDashboard,
      isActive: (pathname) => pathname === '/' || pathname === '/dashboard'
    },
    {
      to: '/scopes',
      label: 'Scopes',
      icon: Network,
      isActive: (pathname) => pathname.startsWith('/scopes') || pathname.startsWith('/subnets')
    },
    {
      to: '/leases',
      label: 'Leases',
      icon: Wifi,
      isActive: (pathname) => pathname.startsWith('/leases')
    },
    {
      to: '/logs',
      label: 'Logs',
      icon: Terminal,
      isActive: (pathname) => pathname.startsWith('/logs') || pathname.startsWith('/service')
    },
    {
      to: '/settings',
      label: 'Settings',
      icon: Settings,
      isActive: (pathname) => pathname.startsWith('/settings')
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-200"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed lg:sticky top-0 inset-y-0 left-0 z-50 w-64 lg:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-white/10 flex flex-col h-screen transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="p-5 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white shadow-glow-indigo">
              <Activity size={22} />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
                Kea DHCP UI
              </h1>
              <span className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
                Control Panel
              </span>
            </div>
          </div>

          {/* Close button for mobile */}
          <button
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 flex-1 flex flex-col gap-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.isActive(location.pathname);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={`w-full h-11 px-3.5 flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon size={19} className={active ? 'text-white' : 'text-slate-400 dark:text-slate-500'} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
