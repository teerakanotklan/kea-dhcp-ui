import { Request, Response } from 'express';
import systemService from '../services/systemService';
import dhcpConfigService from '../services/dhcpConfigService';
import { ServiceAction } from '@kea/shared';

export class ServiceController {
  getStatus(_req: Request, res: Response) {
    try {
      const status = systemService.getServiceStatus();
      return res.json(status);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: errMsg });
    }
  }

  async getSettings(_req: Request, res: Response) {
    try {
      const settings = await dhcpConfigService.getGlobalSettings();
      return res.json(settings);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: errMsg });
    }
  }

  async updateSettings(req: Request, res: Response) {
    try {
      const updated = await dhcpConfigService.updateGlobalSettings(req.body);
      return res.json(updated);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ error: errMsg });
    }
  }

  controlService(req: Request, res: Response) {
    const { action, target } = req.body;
    if (!action) {
      return res.status(400).json({ error: 'Action is required (restart, reload, stop, start)' });
    }

    try {
      const result = systemService.controlService(action as ServiceAction, target || 'all');
      return res.json(result);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: errMsg });
    }
  }

  getLogs(req: Request, res: Response) {
    try {
      const limit = parseInt(String(req.query.limit || 100), 10) || 100;
      const target = typeof req.query.service === 'string' ? req.query.service : 'all';
      const logs = systemService.getLogs(target, limit);
      return res.json(logs);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: errMsg });
    }
  }
}

export default new ServiceController();
