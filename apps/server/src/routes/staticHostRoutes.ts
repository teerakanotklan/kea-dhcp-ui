import express from 'express';
import authMiddleware from '../middleware/auth';
import staticHostController from '../controllers/staticHostController';

const router = express.Router();

// GET /api/static-hosts
router.get('/', authMiddleware, staticHostController.getStaticHosts.bind(staticHostController));

// GET /api/static-hosts/:id
router.get('/:id', authMiddleware, staticHostController.getStaticHostById.bind(staticHostController));

// POST /api/static-hosts
router.post('/', authMiddleware, staticHostController.createStaticHost.bind(staticHostController));

export default router;
