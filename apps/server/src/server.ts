import { Server } from 'http';
import app from './app';
import config from './config/default';
import keaService from './services/keaService';
import clusterSyncService from './services/clusterSyncService';

export function startServer(): Server {
  // Register auto-sync listener and background monitoring
  keaService.onConfigChange(() => {
    clusterSyncService.notifyConfigChanged();
  });
  clusterSyncService.startBackgroundSyncLoop();

  const server = app.listen(config.port, () => {
    console.log(`===============================================`);
    console.log(`Kea DHCP Server Web Management Service`);
    console.log(`URL:              http://localhost:${config.port}`);
    console.log(
      `Mode:             ${
        config.isProduction
          ? 'PRODUCTION (Real Kea daemons)'
          : 'MOCKUP DATA (PRODUCTION=NO simulation)'
      }`
    );
    console.log(`DHCPv4 Service:   ${config.dhcpService}`);
    console.log(`Control Agent:    ${config.ctrlAgentService} (${config.keaCtrlAgentUrl})`);
    console.log(`Kea Config:       ${config.confPath}`);
    console.log(`Backups:          ${config.backupDir}`);
    console.log(`===============================================`);
  });

  return server;
}

export default startServer;
