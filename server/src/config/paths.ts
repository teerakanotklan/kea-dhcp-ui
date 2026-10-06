import path from 'path';
import fs from 'fs';

export function getProjectRoot(): string {
  let curr = __dirname;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(curr, 'client')) && fs.existsSync(path.join(curr, 'server'))) {
      return curr;
    }
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return path.resolve(__dirname, '..', '..', '..');
}

export const PROJECT_ROOT = getProjectRoot();
export const DATA_DIR = path.join(PROJECT_ROOT, 'server', 'data');
export const CLIENT_DIST = path.join(PROJECT_ROOT, 'client', 'dist');
