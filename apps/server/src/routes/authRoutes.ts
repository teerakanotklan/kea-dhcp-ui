import express from 'express';
import authController from '../controllers/authController';
import authMiddleware from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { LoginRequestSchema, ChangePasswordRequestSchema } from '@kea/shared';

const router = express.Router();

// POST /api/auth/login
router.post(
  '/login',
  validateRequest({ body: LoginRequestSchema }),
  authController.login.bind(authController)
);

// GET /api/auth/me
router.get('/me', authMiddleware, authController.getMe.bind(authController));

// POST /api/auth/change-password
router.post(
  '/change-password',
  authMiddleware,
  validateRequest({ body: ChangePasswordRequestSchema }),
  authController.changePassword.bind(authController)
);

export default router;
