import express from 'express';
import authMiddleware from '../middleware/auth';
import leaseController from '../controllers/leaseController';

const router = express.Router();

// GET /api/leases
router.get('/', authMiddleware, leaseController.getLeases.bind(leaseController));

// POST /api/leases/:ip/release
router.post('/:ip/release', authMiddleware, leaseController.releaseLease.bind(leaseController));

// POST /api/leases/:ip/reserve
router.post('/:ip/reserve', authMiddleware, leaseController.reserveLease.bind(leaseController));

export default router;
