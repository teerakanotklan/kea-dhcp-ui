/**
 * Entry Loader for Kea DHCP Web UI Backend
 * Dispatches to compiled TypeScript in apps/server/dist
 */
import path from 'path';
import fs from 'fs';

const entry = path.join(__dirname, 'dist', 'index.js');

if (fs.existsSync(entry)) {
  require(entry);
} else {
  console.error('[Error] Compiled backend not found at: ' + entry);
  console.error('Please run "pnpm --filter @kea/server run build" before starting the service.');
  process.exit(1);
}
