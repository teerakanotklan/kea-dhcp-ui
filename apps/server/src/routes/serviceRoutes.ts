import express from 'express';
import authMiddleware from '../middleware/auth';
import serviceController from '../controllers/serviceController';

const router = express.Router();

// GET /api/service/status
router.get('/status', authMiddleware, serviceController.getStatus.bind(serviceController));

// GET /api/service/settings
router.get('/settings', authMiddleware, serviceController.getSettings.bind(serviceController));

// PUT /api/service/settings
router.put('/settings', authMiddleware, serviceController.updateSettings.bind(serviceController));

// POST /api/service/control
router.post('/control', authMiddleware, serviceController.controlService.bind(serviceController));

// GET /api/service/logs
router.get('/logs', authMiddleware, serviceController.getLogs.bind(serviceController));

export default router;
