import fs from 'fs';
import { KeaRawLease } from '@kea/shared';

/**
 * Parse Kea Memfile CSV leases file safely
 */
export function parseLeasesCsv(csvPath: string): KeaRawLease[] {
  try {
    if (!fs.existsSync(csvPath)) return [];
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    if (lines.length <= 1) return [];

    const headers = lines[0].split(',').map((h) => h.trim());
    const leaseMap = new Map<string, KeaRawLease>();

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = parts[idx];
      });

      const ip = obj.address || obj['ip-address'];
      if (!ip) continue;

      const validLft = parseInt(obj.valid_lifetime || obj['valid-lft'] || '0', 10);
      const expire = parseInt(obj.expire || '0', 10);
      const cltt = parseInt(
        obj.cltt || (expire && validLft ? String(expire - validLft) : String(expire)) || '0',
        10
      );

      const current: KeaRawLease = {
        'ip-address': ip,
        'hw-address': obj.hwaddr || obj['hw-address'] || '',
        'valid-lft': validLft,
        cltt: cltt,
        hostname: obj.hostname || '',
        state: parseInt(obj.state || '0', 10),
        'subnet-id': parseInt(obj.subnet_id || obj['subnet-id'] || '1', 10)
      };

      const existing = leaseMap.get(ip);
      const existingCltt = existing ? parseInt(String(existing.cltt || 0), 10) : 0;
      if (!existing || cltt > existingCltt) {
        leaseMap.set(ip, current);
      }
    }
    return Array.from(leaseMap.values());
  } catch {
    return [];
  }
}
