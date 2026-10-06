import express, { Request, Response } from 'express';
import authService from '../services/authService';
import authMiddleware from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { LoginRequestSchema, ChangePasswordRequestSchema } from '../../../shared/types/auth';

const router = express.Router();

// POST /api/auth/login
router.post(
  '/login',
  validateRequest({ body: LoginRequestSchema }),
  (req: Request, res: Response) => {
    const { username, password } = req.body;
    const result = authService.authenticate(username, password);
    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    return res.json(result);
  }
);

// GET /api/auth/me
router.get('/me', authMiddleware, (req: Request, res: Response) => {
  return res.json({ user: req.user });
});

// POST /api/auth/change-password
router.post(
  '/change-password',
  authMiddleware,
  validateRequest({ body: ChangePasswordRequestSchema }),
  (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const result = authService.changePassword(req.user.id, currentPassword, newPassword);
      return res.json(result);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ error: errMsg });
    }
  }
);

export default router;
