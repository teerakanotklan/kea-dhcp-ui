import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Moon, Sun, LogOut, Menu, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

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
    const crumbs: BreadcrumbItem[] = [{ label: 'Static IPs', to: '/static-hosts' }];
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
    return [{ label: 'Leases', to: '/leases' }];
  }

  if (pathname.startsWith('/logs') || pathname.startsWith('/service')) {
    return [{ label: 'Logs', to: '/logs' }];
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

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 px-4 sm:px-6 lg:px-8 flex items-center justify-between shadow-sm dark:shadow-none gap-4">
      {/* Left side: Hamburger button on mobile / Desktop sidebar toggle + Dynamic Breadcrumbs */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors shrink-0"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>

        {/* Desktop Sidebar Collapse Toggle */}
        <button
          className="hidden lg:flex p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors shrink-0"
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
                    } ${crumb.mono ? 'font-mono text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10' : ''} whitespace-nowrap truncate`}
                  >
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Right side: Theme Switcher & Admin User Info */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Theme Toggle */}
        <button
          className="btn-icon"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        >
          {theme === 'dark' ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-slate-600" />}
        </button>

        {/* User Info & Logout */}
        <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-slate-200 dark:border-white/10">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
              {user?.name || user?.username}
            </span>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 tracking-wider">
              ADMINISTRATOR
            </span>
          </div>
          <button
            className="btn-icon text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
            onClick={logout}
            title="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
