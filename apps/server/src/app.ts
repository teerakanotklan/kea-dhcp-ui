import path from 'path';
import fs from 'fs';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import config from './config/default';
import { CLIENT_DIST } from './config/paths';

import authRoutes from './routes/authRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import scopeRoutes from './routes/scopeRoutes';
import staticHostRoutes from './routes/staticHostRoutes';
import leaseRoutes from './routes/leaseRoutes';
import serviceRoutes from './routes/serviceRoutes';
import clusterRoutes from './routes/clusterRoutes';

export function createApp(): express.Application {
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

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    return res.json({
      status: 'ok',
      production: config.isProduction,
      isProduction: config.isProduction,
      mode: config.mode,
      services: {
        dhcp4: config.dhcpService,
        ctrlAgent: config.ctrlAgentService
      },
      keaCtrlAgentUrl: config.keaCtrlAgentUrl,
      time: new Date().toISOString()
    });
  });

  // Serve frontend static bundle if client/dist exists (production mode)
  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get('*', (req: Request, res: Response) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(CLIENT_DIST, 'index.html'));
      }
    });
  }

  // Centralized error handling middleware
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[API Error]:', err);
    const errMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return res.status(500).json({ error: errMsg });
  });

  return app;
}

export const app = createApp();
export default app;
