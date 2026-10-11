import path from 'path';
import fs from 'fs';

export function getProjectRoot(): string {
  let curr = __dirname;
  for (let i = 0; i < 6; i++) {
    if (
      (fs.existsSync(path.join(curr, 'apps')) && fs.existsSync(path.join(curr, 'packages'))) ||
      (fs.existsSync(path.join(curr, 'apps', 'client')) && fs.existsSync(path.join(curr, 'apps', 'server'))) ||
      (fs.existsSync(path.join(curr, 'client')) && fs.existsSync(path.join(curr, 'server')))
    ) {
      return curr;
    }
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return path.resolve(__dirname, '..', '..', '..');
}

export const PROJECT_ROOT = getProjectRoot();

export const DATA_DIR = fs.existsSync(path.join(PROJECT_ROOT, 'apps', 'server', 'data'))
  ? path.join(PROJECT_ROOT, 'apps', 'server', 'data')
  : path.join(PROJECT_ROOT, 'server', 'data');

export const CLIENT_DIST = fs.existsSync(path.join(PROJECT_ROOT, 'apps', 'client', 'dist'))
  ? path.join(PROJECT_ROOT, 'apps', 'client', 'dist')
  : path.join(PROJECT_ROOT, 'client', 'dist');
