/**
 * Production Entry Loader for Kea DHCP Web UI Backend
 * Dispatches to compiled TypeScript in server/dist
 */
const path = require('path');
const fs = require('fs');

const nestedEntry = path.join(__dirname, 'dist', 'server', 'src', 'index.js');
const flatEntry = path.join(__dirname, 'dist', 'index.js');

if (fs.existsSync(nestedEntry)) {
  require(nestedEntry);
} else if (fs.existsSync(flatEntry)) {
  require(flatEntry);
} else {
  console.error('[Error] Compiled backend not found.');
  console.error(`Checked:\n - ${nestedEntry}\n - ${flatEntry}`);
  console.error('Please run "npm --prefix server run build" before starting the service.');
  process.exit(1);
}
