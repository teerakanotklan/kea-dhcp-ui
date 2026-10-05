import { User } from '../../../shared/types/auth';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
