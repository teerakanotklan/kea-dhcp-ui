import React, { ReactNode } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';

export interface AppLayoutProps {
  children: ReactNode;
  theme: string;
  toggleTheme: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  toggleSidebarCollapse: () => void;
}

export function AppLayout({
  children,
  theme,
  toggleTheme,
  mobileMenuOpen,
  setMobileMenuOpen,
  sidebarCollapsed,
  toggleSidebarCollapse
}: AppLayoutProps) {
  return (
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
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
