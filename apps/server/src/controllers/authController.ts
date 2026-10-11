import { Request, Response } from 'express';
import authService from '../services/authService';

export class AuthController {
  login(req: Request, res: Response) {
    const { username, password } = req.body;
    const result = authService.authenticate(username, password);
    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }
    return res.json(result);
  }

  getMe(req: Request, res: Response) {
    return res.json({ user: req.user });
  }

  changePassword(req: Request, res: Response) {
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
}

export default new AuthController();
