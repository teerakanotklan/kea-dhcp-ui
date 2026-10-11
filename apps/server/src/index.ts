import path from 'path';
import dotenv from 'dotenv';
import { PROJECT_ROOT } from './config/paths';

// Load environment variables from root .env or server/.env
try {
  dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });
  dotenv.config();
} catch {
  // dotenv not available, continue using process.env
}

import app from './app';
import { startServer } from './server';

// Start server process
startServer();

export { app, startServer };
export default app;
