import keaService from './keaService';
import dhcpConfigService from './dhcpConfigService';
import { DhcpLease, LeaseStatus } from '../../../shared/types/lease';
import { Subnet } from '../../../shared/types/subnet';

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

export function isIpInSubnet(ip: string, cidrStr?: string): boolean {
  if (!cidrStr || !cidrStr.includes('/')) return false;
  const [rangeIp, prefixStr] = cidrStr.split('/');
  const prefix = parseInt(prefixStr, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipToInt(ip) & mask) === (ipToInt(rangeIp) & mask);
}

export interface ConvertReservationInput {
  ip: string;
  mac: string;
  hostname?: string;
  subnetId?: string | number;
  overwrite?: boolean;
}

export class DhcpLeaseService {
  async getLeases(): Promise<DhcpLease[]> {
    try {
      const rawLeases = await keaService.getAllLeases();
      const now = Date.now();

      // 1. Fetch current host reservations to identify reserved leases and conflicts
      const resByIp = new Map<string, { ip?: string; mac?: string; hostname?: string; name?: string }>();
      const resByMac = new Map<string, { ip?: string; mac?: string; hostname?: string; name?: string }>();
      let subnetsList: Subnet[] = [];
      try {
        const cfg = await dhcpConfigService.parseConfig();
        if (cfg && cfg.hosts) {
          cfg.hosts.forEach((h) => {
            const cleanIp = (h.ip || '').trim();
            const cleanMac = (h.mac || '').toLowerCase().trim();
            if (cleanIp) resByIp.set(cleanIp, h);
            if (cleanMac) resByMac.set(cleanMac, h);
          });
        }
        if (cfg && cfg.subnets) {
          subnetsList = cfg.subnets;
        }
      } catch (e) {
        // Fallback if config parsing fails
      }

      // 2. Deduplicate raw leases by IP, keeping the latest entry (highest cltt)
      const leaseMap = new Map<string, typeof rawLeases[0]>();
      for (const l of rawLeases) {
        const ip = l['ip-address'] || l.ip || '';
        if (!ip) continue;
        const cltt = parseInt(String(l.cltt || 0), 10);
        const existing = leaseMap.get(ip);
        if (!existing || cltt > parseInt(String(existing.cltt || 0), 10)) {
          leaseMap.set(ip, l);
        }
      }

      const deduplicated = Array.from(leaseMap.values());

      // 3. Transform and calculate status with strict matching
      const leases: DhcpLease[] = deduplicated.map((l) => {
        const ip = l['ip-address'] || l.ip || '';
        const mac = (l['hw-address'] || l.mac || '').toLowerCase();
        const hostname = l.hostname || '';
        const cltt = parseInt(String(l.cltt || 0), 10);
        const validLft = parseInt(String(l['valid-lft'] || l.validLft || 0), 10);

        let starts: string | null = null;
        let ends: string | null = null;
        let remainingSeconds = 0;
        let isExpired = false;

        if (cltt > 0) {
          const startTimeMs = cltt * 1000;
          starts = new Date(startTimeMs).toISOString();

          if (validLft > 0) {
            const endTimeMs = (cltt + validLft) * 1000;
            ends = new Date(endTimeMs).toISOString();
            remainingSeconds = Math.max(0, Math.floor((endTimeMs - now) / 1000));
            if (endTimeMs < now) {
              isExpired = true;
            }
          }
        }

        // Strict Matching: A lease is only 'reserved' if BOTH IP and MAC match
        const resForIp = resByIp.get(ip);
        const resForMac = mac ? resByMac.get(mac) : null;

        let status: LeaseStatus = 'active';
        let isReserved = false;
        let isConflict = false;
        let conflictInfo: { reservedForMac?: string; reservedForHostname?: string } | null = null;

        if (resForIp && (resForIp.mac || '').toLowerCase() === mac) {
          // Strict Match: Both IP and MAC match the configured reservation
          status = 'reserved';
          isReserved = true;
        } else if (resForIp && (resForIp.mac || '').toLowerCase() !== mac) {
          // Conflict: IP is reserved for another device, but currently occupied by this lease!
          status = 'conflict';
          isConflict = true;
          conflictInfo = {
            reservedForMac: resForIp.mac,
            reservedForHostname: resForIp.name || resForIp.hostname || 'Unknown'
          };
        } else if (resForMac && resForMac.ip !== ip) {
          // Client has a reservation on another IP, currently using temporary pool IP
          status = 'active';
        } else if (l.state === 1) {
          status = 'declined';
        } else if (l.state === 2 || isExpired) {
          status = 'expired';
        } else {
          status = 'active';
        }

        // Match subnet ID or subnet CIDR
        let subnetId: string | number = l['subnet-id'] || 1;
        const matchedSubnet = subnetsList.find((s) => isIpInSubnet(ip, s.subnetCidr));
        if (matchedSubnet) {
          subnetId = matchedSubnet.id;
        }

        return {
          ip,
          mac,
          hostname,
          bindingState: status,
          status,
          isReserved,
          isConflict,
          conflictInfo,
          starts,
          ends,
          remainingSeconds,
          subnetId
        };
      });

      return leases.sort((a, b) => {
        if (a.status === 'conflict') return -1;
        if (b.status === 'conflict') return 1;
        if (a.status === 'reserved' && b.status !== 'reserved') return -1;
        if (a.status !== 'reserved' && b.status === 'reserved') return 1;
        return a.ip.localeCompare(b.ip, undefined, { numeric: true });
      });
    } catch (err) {
      return [];
    }
  }

  async releaseLease(ip: string): Promise<{ success: boolean; message: string }> {
    if (!ip) {
      throw new Error('IP address is required');
    }
    return await keaService.releaseLease(ip);
  }

  async convertToReservation({ ip, mac, hostname, subnetId, overwrite = false }: ConvertReservationInput): Promise<{ success: boolean; message: string }> {
    if (!ip || !mac) {
      throw new Error('IP address and MAC address are required');
    }

    const subnets = await dhcpConfigService.getSubnets();
    if (!subnets || subnets.length === 0) {
      throw new Error('No DHCP scopes configured in system');
    }

    const cleanMac = mac.trim().replace(/-/g, ':').toLowerCase();
    const cleanIp = ip.trim();
    const cleanHostname = (hostname || '').trim();

    // Determine target subnet: either matched by subnetId or by IP CIDR
    let targetSubnet: Subnet | undefined = undefined;
    if (subnetId) {
      targetSubnet = subnets.find((s) => String(s.id) === String(subnetId) || s.subnetCidr === subnetId);
    }
    if (!targetSubnet) {
      targetSubnet = subnets.find((s) => isIpInSubnet(cleanIp, s.subnetCidr)) || subnets[0];
    }

    if (overwrite) {
      // Force release any active lease for this IP in Kea's runtime memory & lease database
      try {
        await keaService.releaseLease(cleanIp);
      } catch (e) {
        // If lease wasn't in memory, proceed with reservation update
      }
    }

    await dhcpConfigService.addReservation(targetSubnet.id, {
      hwAddress: cleanMac,
      ipAddress: cleanIp,
      hostname: cleanHostname
    }, { overwrite });

    return {
      success: true,
      message: `IP ${cleanIp} (${cleanMac}) reserved successfully in scope ${targetSubnet.name || targetSubnet.subnetCidr}`
    };
  }
}

export default new DhcpLeaseService();
