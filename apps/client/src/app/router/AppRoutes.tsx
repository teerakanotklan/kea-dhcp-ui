import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { NotificationState } from '@kea/shared';
import { Dashboard } from '../../pages/Dashboard';
import { Scopes } from '../../pages/scopes/Scopes';
import { ScopeForm } from '../../pages/scopes/ScopeForm';
import { StaticIP } from '../../pages/static-hosts/StaticIP';
import { StaticIPForm } from '../../pages/static-hosts/StaticIPForm';
import { Leases } from '../../pages/Leases';
import { ClusterDashboard } from '../../pages/cluster/ClusterDashboard';
import { ClusterAddPage } from '../../pages/cluster/ClusterAddPage';
import { ServiceLogs } from '../../pages/ServiceLogs';
import { LogDetail } from '../../pages/LogDetail';
import { Settings } from '../../pages/Settings';
import { NotFound } from '../../pages/NotFound';

export interface AppRoutesProps {
  setNotification: (notif: NotificationState) => void;
}

export function AppRoutes({ setNotification }: AppRoutesProps) {
  return (
    <Routes>
      {/* Dashboard */}
      <Route path="/" element={<Dashboard setNotification={setNotification} />} />

      {/* Scopes Multi-Page */}
      <Route path="/scopes" element={<Scopes setNotification={setNotification} />} />
      <Route path="/scopes/add" element={<ScopeForm setNotification={setNotification} />} />
      <Route path="/scopes/:id/edit" element={<ScopeForm setNotification={setNotification} />} />

      {/* Static IP Multi-Page */}
      <Route path="/static-hosts" element={<StaticIP setNotification={setNotification} />} />
      <Route path="/static-hosts/add" element={<StaticIPForm setNotification={setNotification} />} />
      <Route path="/static-hosts/:id/edit" element={<StaticIPForm setNotification={setNotification} />} />

      {/* Leases & Cluster */}
      <Route path="/leases" element={<Leases setNotification={setNotification} />} />
      <Route path="/cluster" element={<ClusterDashboard setNotification={setNotification} />} />
      <Route path="/cluster/add" element={<ClusterAddPage setNotification={setNotification} />} />

      {/* Service Logs */}
      <Route path="/logs" element={<ServiceLogs setNotification={setNotification} />} />
      <Route path="/logs/:id" element={<LogDetail setNotification={setNotification} />} />

      {/* Settings */}
      <Route path="/settings" element={<Settings setNotification={setNotification} />} />

      {/* Fallback 404 Error Page */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default AppRoutes;
