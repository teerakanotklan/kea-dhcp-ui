import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { ProtectedRoute } from './app/router/ProtectedRoute';
import { AppLayout } from './app/layouts/AppLayout';
import { AppRoutes } from './app/router/AppRoutes';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { NotificationState } from '@kea/shared';

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
    const timer = setTimeout(() => {
      document.documentElement.classList.remove('disable-transitions');
    }, 50);
    return () => clearTimeout(timer);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('dhcp_theme', nextTheme);
  };

  // Toast notification auto-dismiss timer
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 4000);
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
              <AppLayout
                theme={theme}
                toggleTheme={toggleTheme}
                mobileMenuOpen={mobileMenuOpen}
                setMobileMenuOpen={setMobileMenuOpen}
                sidebarCollapsed={sidebarCollapsed}
                toggleSidebarCollapse={toggleSidebarCollapse}
              >
                <AppRoutes setNotification={triggerNotification} />
              </AppLayout>
            </ProtectedRoute>
          }
        />
      </Routes>

      {/* Global Notification Toast */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3.5 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl bg-white/95 dark:bg-slate-900/95 border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-slate-100 animate-fadeIn">
          {notification.type === 'success' && (
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}
          {notification.type === 'error' && (
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0 border border-rose-500/20">
              <AlertTriangle className="w-4 h-4" />
            </div>
          )}
          {notification.type === 'warning' && (
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4" />
            </div>
          )}
          {notification.type === 'info' && (
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center shrink-0 border border-cyan-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}
          <div className="text-xs sm:text-sm font-semibold">{notification.message}</div>
          <button
            onClick={() => setNotification(null)}
            className="ml-2 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            aria-label="Close notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
