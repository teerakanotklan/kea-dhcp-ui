import express from 'express';
import authMiddleware from '../middleware/auth';
import dashboardController from '../controllers/dashboardController';

const router = express.Router();

// GET /api/dashboard
router.get('/', authMiddleware, dashboardController.getDashboardData.bind(dashboardController));

export default router;
