import { Request, Response } from 'express';
import dhcpLeaseService from '../services/dhcpLeaseService';

export class LeaseController {
  async getLeases(req: Request, res: Response) {
    try {
      let leases = await dhcpLeaseService.getLeases();
      const { status, search } = req.query;

      if (status && typeof status === 'string' && status !== 'all') {
        leases = leases.filter((l) => l.status === status);
      }

      if (search && typeof search === 'string') {
        const q = search.toLowerCase();
        leases = leases.filter(
          (l) =>
            l.ip.includes(q) ||
            (l.mac && l.mac.toLowerCase().includes(q)) ||
            (l.hostname && l.hostname.toLowerCase().includes(q))
        );
      }

      return res.json({
        total: leases.length,
        leases
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: errMsg });
    }
  }

  async releaseLease(req: Request, res: Response) {
    try {
      const result = await dhcpLeaseService.releaseLease(req.params.ip);
      return res.json(result);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ error: errMsg });
    }
  }

  async reserveLease(req: Request, res: Response) {
    try {
      const { mac, hostname, subnetId, overwrite } = req.body;
      const ip = req.params.ip;
      const result = await dhcpLeaseService.convertToReservation({
        ip,
        mac,
        hostname,
        subnetId,
        overwrite: Boolean(overwrite)
      });
      return res.json(result);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ error: errMsg });
    }
  }
}

export default new LeaseController();
