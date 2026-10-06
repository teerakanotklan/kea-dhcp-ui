import path from 'path';
import dotenv from 'dotenv';
import { PROJECT_ROOT, CLIENT_DIST } from './config/paths';

// Load environment variables from root .env or server/.env
try {
  dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });
  dotenv.config();
} catch (e) {
  // dotenv not available, continue using process.env
}

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fs from 'fs';
import config from './config/default';

import authRoutes from './routes/authRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import scopeRoutes from './routes/scopeRoutes';
import staticHostRoutes from './routes/staticHostRoutes';
import leaseRoutes from './routes/leaseRoutes';
import serviceRoutes from './routes/serviceRoutes';
import clusterRoutes from './routes/clusterRoutes';
import keaService from './services/keaService';
import clusterSyncService from './services/clusterSyncService';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/scopes', scopeRoutes);
app.use('/api/static-hosts', staticHostRoutes);
app.use('/api/leases', leaseRoutes);
app.use('/api/service', serviceRoutes);
app.use('/api/cluster', clusterRoutes);

// Register auto-sync listener and background monitoring
keaService.onConfigChange(() => {
  clusterSyncService.notifyConfigChanged();
});
clusterSyncService.startBackgroundSyncLoop();

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  return res.json({
    status: 'ok',
    services: {
      dhcp4: config.dhcpService,
      ctrlAgent: config.ctrlAgentService
    },
    keaCtrlAgentUrl: config.keaCtrlAgentUrl,
    time: new Date().toISOString()
  });
});

// Serve frontend in production build if client/dist exists
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req: Request, res: Response) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    }
  });
}

// Error handling middleware
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API Error]:', err);
  const errMsg = err instanceof Error ? err.message : 'Internal Server Error';
  return res.status(500).json({ error: errMsg });
});

app.listen(config.port, () => {
  console.log(`===============================================`);
  console.log(`Kea DHCP Server Web Management Service`);
  console.log(`URL:              http://localhost:${config.port}`);
  console.log(`DHCPv4 Service:   ${config.dhcpService}`);
  console.log(`Control Agent:    ${config.ctrlAgentService} (${config.keaCtrlAgentUrl})`);
  console.log(`Kea Config:       ${config.confPath}`);
  console.log(`Backups:          ${config.backupDir}`);
  console.log(`===============================================`);
});

export default app;
