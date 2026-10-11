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
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 animate-in slide-in-from-bottom-5">
          {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
          {notification.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0" />}
          {notification.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />}
          {notification.type === 'info' && <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" />}
          <div className="text-sm font-medium">{notification.message}</div>
          <button
            onClick={() => setNotification(null)}
            className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
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
