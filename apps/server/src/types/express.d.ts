import { User } from '@kea/shared';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
