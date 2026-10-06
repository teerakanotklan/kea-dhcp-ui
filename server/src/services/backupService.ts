import fs from 'fs';
import path from 'path';
import config from '../config/default';

export interface BackupMetadata {
  filename: string;
  timestamp: string;
  note: string;
  size: number;
}

export class BackupService {
  private backupDir: string;

  constructor() {
    this.backupDir = config.backupDir;
    if (!fs.existsSync(this.backupDir)) {
      try {
        fs.mkdirSync(this.backupDir, { recursive: true });
      } catch (e) {
        // Ignored if permissions don't allow
      }
    }
  }

  createBackup(sourcePath: string, note = ''): BackupMetadata | null {
    if (!fs.existsSync(sourcePath)) return null;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `kea-dhcp4.conf.bak_${timestamp}`;
    const targetPath = path.join(this.backupDir, filename);

    fs.copyFileSync(sourcePath, targetPath);

    // Save metadata
    const metaPath = path.join(this.backupDir, `${filename}.json`);
    const meta: BackupMetadata = {
      filename,
      timestamp: new Date().toISOString(),
      note,
      size: fs.statSync(targetPath).size
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

    return meta;
  }

  listBackups(): BackupMetadata[] {
    if (!fs.existsSync(this.backupDir)) return [];

    const files = fs.readdirSync(this.backupDir);
    const backups: BackupMetadata[] = [];

    for (const f of files) {
      if (f.endsWith('.json')) {
        try {
          const raw = fs.readFileSync(path.join(this.backupDir, f), 'utf8');
          backups.push(JSON.parse(raw) as BackupMetadata);
        } catch (e) {
          // ignore corrupted meta
        }
      }
    }

    return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  restoreBackup(filename: string, targetPath: string = config.confPath): { success: boolean; message: string } {
    const backupFilePath = path.join(this.backupDir, filename);
    if (!fs.existsSync(backupFilePath)) {
      throw new Error(`Backup file ${filename} not found`);
    }

    // Create a backup of the current state before restoring!
    this.createBackup(targetPath, `Auto backup before restoring ${filename}`);

    fs.copyFileSync(backupFilePath, targetPath);
    return { success: true, message: `Successfully restored backup ${filename}` };
  }
}

export default new BackupService();
