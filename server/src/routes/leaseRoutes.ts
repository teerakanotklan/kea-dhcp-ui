import express, { Request, Response } from 'express';
import authMiddleware from '../middleware/auth';
import dhcpLeaseService from '../services/dhcpLeaseService';

const router = express.Router();

// GET /api/leases
router.get('/', authMiddleware, async (req: Request, res: Response) => {
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
});

// POST /api/leases/:ip/release
router.post('/:ip/release', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await dhcpLeaseService.releaseLease(req.params.ip);
    return res.json(result);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return res.status(400).json({ error: errMsg });
  }
});

// POST /api/leases/:ip/reserve
router.post('/:ip/reserve', authMiddleware, async (req: Request, res: Response) => {
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
});

export default router;
