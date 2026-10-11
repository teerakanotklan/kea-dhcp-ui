import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Moon,
  Sun,
  LogOut,
  Menu,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Server,
  ShieldCheck,
  Sparkles,
  RefreshCw
} from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  to?: string;
  mono?: boolean;
}

function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (pathname === '/' || pathname === '/dashboard') {
    return [{ label: 'Dashboard', to: '/' }];
  }

  if (pathname.startsWith('/scopes') || pathname.startsWith('/subnets')) {
    const isScopeUrl = pathname.startsWith('/scopes');
    const baseTo = isScopeUrl ? '/scopes' : '/subnets';
    const crumbs: BreadcrumbItem[] = [{ label: 'Scopes', to: baseTo }];
    if (pathname.endsWith('/add')) {
      crumbs.push({ label: 'Add New Scope' });
    } else if (pathname.includes('/edit')) {
      const match = pathname.match(/\/(?:scopes|subnets)\/(.+?)\/edit/);
      if (match && match[1]) {
        crumbs.push({ label: `Scope #${decodeURIComponent(match[1])}`, mono: true });
        crumbs.push({ label: 'Edit' });
      } else {
        crumbs.push({ label: 'Edit' });
      }
    }
    return crumbs;
  }

  if (pathname.startsWith('/static-hosts')) {
    const crumbs: BreadcrumbItem[] = [{ label: 'Static Reservations', to: '/static-hosts' }];
    if (pathname === '/static-hosts/add') {
      crumbs.push({ label: 'Add Reservation' });
    } else if (pathname.includes('/edit')) {
      const match = pathname.match(/\/static-hosts\/(.+?)\/edit/);
      if (match && match[1]) {
        crumbs.push({ label: decodeURIComponent(match[1]), mono: true });
        crumbs.push({ label: 'Edit' });
      } else {
        crumbs.push({ label: 'Edit' });
      }
    }
    return crumbs;
  }

  if (pathname.startsWith('/leases')) {
    return [{ label: 'Active Leases', to: '/leases' }];
  }

  if (pathname.startsWith('/cluster')) {
    return [{ label: 'Cluster & HA', to: '/cluster' }];
  }

  if (pathname.startsWith('/logs') || pathname.startsWith('/service')) {
    return [{ label: 'Service Logs', to: '/logs' }];
  }

  if (pathname.startsWith('/settings')) {
    return [{ label: 'Settings', to: '/settings' }];
  }

  return [{ label: 'Dashboard', to: '/' }];
}

export interface NavbarProps {
  theme: string;
  toggleTheme: () => void;
  onOpenMobileMenu: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Navbar({ theme, toggleTheme, onOpenMobileMenu, isCollapsed, onToggleCollapse }: NavbarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const breadcrumbs = getBreadcrumbs(location.pathname);
  const [isMockMode, setIsMockMode] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => {
        if (d.mode === 'mock' || d.production === false || d.isProduction === false) {
          setIsMockMode(true);
        }
      })
      .catch(() => {});
  }, []);

  const userInitial = (user?.name || user?.username || 'A').charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.08] px-4 sm:px-6 lg:px-8 flex items-center justify-between shadow-xs transition-colors duration-200 gap-4">
      {/* Left side: Hamburger on mobile / Desktop sidebar toggle + Breadcrumbs */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shrink-0"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>

        {/* Desktop Sidebar Collapse Toggle */}
        <button
          className="hidden lg:flex p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shrink-0"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
        </button>

        {/* Breadcrumb Navigation on TopNav */}
        <nav className="flex items-center gap-1.5 text-xs sm:text-sm font-medium overflow-hidden" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <ChevronRight size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
                )}
                {crumb.to && !isLast ? (
                  <Link
                    to={crumb.to}
                    className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors whitespace-nowrap truncate max-w-[120px] sm:max-w-none"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={`${
                      isLast
                        ? 'text-slate-900 dark:text-white font-semibold'
                        : 'text-slate-500 dark:text-slate-400'
                    } ${
                      crumb.mono
                        ? 'font-mono text-xs px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-500/30'
                        : ''
                    } whitespace-nowrap truncate`}
                  >
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Right side: Engine Status Pill, Theme Switcher & Admin User Badge */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Mode & Engine Pill */}
        {isMockMode ? (
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shadow-xs"
            title="Running in simulated mock data mode (kea daemon not running)"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="hidden sm:inline">Mock Data Mode</span>
            <span className="sm:hidden">Mock</span>
          </div>
        ) : (
          <div
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shadow-xs"
            title="Kea DHCP daemon connected and active"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Production Live</span>
          </div>
        )}

        {/* Theme Switcher Button */}
        <button
          className="btn-icon w-9 h-9"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? (
            <Sun size={17} className="text-amber-400 transition-transform duration-300 hover:rotate-45" />
          ) : (
            <Moon size={17} className="text-slate-600 transition-transform duration-300 hover:-rotate-12" />
          )}
        </button>

        {/* User Profile Pill & Sign Out */}
        <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-slate-200/80 dark:border-white/[0.08]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              {userInitial}
            </div>

            <div className="hidden md:flex flex-col text-left leading-tight">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {user?.name || user?.username || 'Admin'}
              </span>
              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 tracking-wider">
                SUPERADMIN
              </span>
            </div>
          </div>

          <button
            className="btn-icon w-9 h-9 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/15 transition-colors"
            onClick={logout}
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
