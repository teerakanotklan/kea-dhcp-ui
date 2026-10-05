import { ServiceAction } from '@shared';

export interface ServiceActionInfo {
  variant: 'warning' | 'danger' | 'primary';
  title: string;
  confirmText: string;
  loadingText: string;
  message: string;
}

export const SERVICE_ACTION_META: Record<ServiceAction, ServiceActionInfo> = {
  restart: {
    variant: 'warning',
    title: 'Restart Service',
    confirmText: 'Restart Service',
    loadingText: 'Restarting...',
    message: 'Restart isc-dhcp-server? Clients may briefly lose DHCP responses while the daemon restarts.',
  },
  reload: {
    variant: 'warning',
    title: 'Reload Configuration',
    confirmText: 'Reload Config',
    loadingText: 'Reloading...',
    message: 'Reload isc-dhcp-server to apply the current configuration?',
  },
  stop: {
    variant: 'danger',
    title: 'Stop Service',
    confirmText: 'Stop Service',
    loadingText: 'Stopping...',
    message: 'Stop isc-dhcp-server? No new IP addresses will be leased until it is started again.',
  },
  start: {
    variant: 'primary',
    title: 'Start Service',
    confirmText: 'Start Service',
    loadingText: 'Starting...',
    message: 'Start the isc-dhcp-server service?',
  },
};
