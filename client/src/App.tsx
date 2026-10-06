import React, { useState, useEffect, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Scopes } from './pages/scopes/Scopes';
import { ScopeForm } from './pages/scopes/ScopeForm';
import { Settings } from './pages/Settings';
import { StaticIP } from './pages/static-hosts/StaticIP';
import { StaticIPForm } from './pages/static-hosts/StaticIPForm';
import { Leases } from './pages/Leases';
import { ServiceLogs } from './pages/ServiceLogs';
import { LogDetail } from './pages/LogDetail';
import { ClusterDashboard } from './pages/cluster/ClusterDashboard';
import { NotFound } from './pages/NotFound';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { NotificationState } from '@shared';

// ProtectedRoute guard with Auth.js-style callbackUrl redirection
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    const callbackUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?callbackUrl=${callbackUrl}`} replace />;
  }

  return <>{children}</>;
}

export function AppContent() {
  const { user, apiFetch } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('dhcp_theme') || 'dark');
  const [, setServiceStatus] = useState<unknown>(null);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const triggerNotification = (notif: NotificationState) => setNotification(notif);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('dhcp_sidebar_collapsed') === 'true';
  });

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('dhcp_sidebar_collapsed', String(next));
      return next;
    });
  };

  // Apply theme instantly without transition lag/delay
  useEffect(() => {
    document.documentElement.classList.add('disable-transitions');
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('dhcp_theme', theme);

    // Force reflow and remove transition suppression in next animation frame
    window.getComputedStyle(document.documentElement).opacity;
    requestAnimationFrame(() => {
      document.documentElement.classList.remove('disable-transitions');
    });
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Auto-dismiss notification after 4 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchServiceAndCounts = async () => {
    if (!user) return;
    try {
      const resStatus = await apiFetch('/api/service/status');
      const statusData = await resStatus.json();
      setServiceStatus(statusData);
    } catch {
      // background poll errors can fail gracefully
    }
  };

  useEffect(() => {
    if (user) {
      fetchServiceAndCounts();
      const interval = setInterval(fetchServiceAndCounts, 15000);
      return () => clearInterval(interval);
    }
  }, [user]);

  return (
    <>
      <Routes>
        {/* Dedicated Login Route */}
        <Route path="/login" element={<Login />} />

        {/* Protected App Shell & Routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div className="h-screen overflow-hidden bg-slate-50 dark:bg-[#070a13] flex text-slate-900 dark:text-slate-100">
                {/* Sidebar with responsive mobile drawer */}
                <Sidebar
                  isOpen={mobileMenuOpen}
                  onClose={() => setMobileMenuOpen(false)}
                  isCollapsed={sidebarCollapsed}
                />

                <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                  <Navbar
                    theme={theme}
                    toggleTheme={toggleTheme}
                    onOpenMobileMenu={() => setMobileMenuOpen(true)}
                    isCollapsed={sidebarCollapsed}
                    onToggleCollapse={toggleSidebarCollapse}
                  />

                  <main className="flex-1 min-h-0 overflow-y-auto flex flex-col">
                    <Routes>
                      {/* Dashboard */}
                      <Route path="/" element={<Dashboard setNotification={triggerNotification} />} />

                      {/* Scopes Multi-Page */}
                      <Route path="/scopes" element={<Scopes setNotification={triggerNotification} />} />
                      <Route path="/scopes/add" element={<ScopeForm setNotification={triggerNotification} />} />
                      <Route path="/scopes/:id/edit" element={<ScopeForm setNotification={triggerNotification} />} />
                      {/* Static IP Multi-Page */}
                      <Route path="/static-hosts" element={<StaticIP setNotification={triggerNotification} />} />
                      <Route path="/static-hosts/add" element={<StaticIPForm setNotification={triggerNotification} />} />
                      <Route path="/static-hosts/:id/edit" element={<StaticIPForm setNotification={triggerNotification} />} />

                      {/* Leases & Logs */}
                      <Route path="/leases" element={<Leases setNotification={triggerNotification} />} />
                      <Route path="/cluster" element={<ClusterDashboard setNotification={triggerNotification} />} />
                      <Route path="/logs" element={<ServiceLogs setNotification={triggerNotification} />} />
                      <Route path="/logs/:id" element={<LogDetail setNotification={triggerNotification} />} />

                      {/* Settings */}
                      <Route path="/settings" element={<Settings setNotification={triggerNotification} />} />

                      {/* Fallback 404 Error Page */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </main>
                </div>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>

      {/* Global Toast Notification */}
      {notification && (
        <div className="toast-container">
          <div
            className={`toast ${
              notification.type === 'error' || notification.type === 'danger'
                ? 'border-rose-500/40'
                : 'border-emerald-500/40'
            }`}
          >
            {notification.type === 'error' || notification.type === 'danger' ? (
              <AlertTriangle size={20} className="text-rose-500 shrink-0" />
            ) : (
              <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
            )}
            <div className="flex-1 text-sm font-medium">{notification.message}</div>
            <button
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded transition-colors"
              onClick={() => setNotification(null)}
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
