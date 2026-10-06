import fs from 'fs';
import config from '../config/default';
import keaService from './keaService';
import { Subnet, ScopeReservation, DhcpCustomOption } from '../../../shared/types/subnet';
import { KeaDhcp4Config, KeaSubnet4, KeaOptionData, KeaReservation } from '../types/kea';

export function maskToCidr(mask?: string | number): number {
  if (!mask) return 24;
  if (typeof mask === 'number') return mask;
  if (/^\d+$/.test(mask)) return parseInt(mask, 10);
  const parts = mask.split('.').map(Number);
  if (parts.length !== 4) return 24;
  let count = 0;
  for (const part of parts) {
    count += (part >>> 0).toString(2).split('1').length - 1;
  }
  return count;
}

export function cidrToMask(cidr?: string | number): string {
  const c = parseInt(String(cidr || 24), 10) || 24;
  const mask: number[] = [];
  for (let i = 0; i < 4; i++) {
    const bits = Math.min(Math.max(c - i * 8, 0), 8);
    mask.push(256 - Math.pow(2, 8 - bits));
  }
  return mask.join('.');
}

export function parseSubnetCidr(subnetStr?: string, netmaskStr?: string): {
  subnet: string;
  baseIp: string;
  netmask: string;
  cidr: number;
} {
  if (!subnetStr) return { subnet: '0.0.0.0/24', baseIp: '0.0.0.0', netmask: '255.255.255.0', cidr: 24 };

  if (subnetStr.includes('/')) {
    const [baseIp, cidrStr] = subnetStr.split('/');
    const cidr = parseInt(cidrStr, 10) || 24;
    return {
      subnet: `${baseIp}/${cidr}`,
      baseIp,
      netmask: cidrToMask(cidr),
      cidr
    };
  }

  const cidr = maskToCidr(netmaskStr);
  return {
    subnet: `${subnetStr}/${cidr}`,
    baseIp: subnetStr,
    netmask: netmaskStr || cidrToMask(cidr),
    cidr
  };
}

export interface ParsedConfig {
  global: {
    defaultLeaseTime: number;
    renewTimer: number;
    rebindTimer: number;
    authoritative: boolean;
  };
  subnets: Subnet[];
  hosts: ScopeReservation[];
  raw: string;
}

export interface GlobalSettings {
  defaultLeaseTime: number;
  renewTimer: number;
  rebindTimer: number;
  domainNameServers: string;
  domainName: string;
  authoritative: boolean;
}

export interface SubnetInputData {
  name?: string;
  subnet: string;
  netmask?: string;
  rangeStart?: string;
  rangeEnd?: string;
  routers?: string;
  domainNameServers?: string;
  domainName?: string;
  defaultLeaseTime?: number | string;
  disabled?: boolean;
  customOptions?: DhcpCustomOption[];
}

export class DhcpConfigService {
  private confPath: string;

  constructor() {
    this.confPath = config.confPath;
  }

  async getRawConfig(): Promise<string> {
    try {
      const keaConfig = await keaService.getConfig();
      return JSON.stringify({ Dhcp4: keaConfig }, null, 2);
    } catch (e) {
      if (fs.existsSync(this.confPath)) {
        return fs.readFileSync(this.confPath, 'utf8');
      }
      return '{}';
    }
  }

  async saveRawConfig(content: string, comment = 'Manual edit via Web UI'): Promise<{ success: boolean; appliedViaAgent: boolean; message: string }> {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      throw new Error(`JSON Syntax Error: ${errMsg}`);
    }

    const dhcp4Config = (parsed.Dhcp4 || parsed) as KeaDhcp4Config;
    return await keaService.setConfig(dhcp4Config, comment);
  }

  validateSyntax(content: string): { valid: boolean; error?: string } {
    try {
      const parsed = JSON.parse(content);
      const dhcp4 = parsed.Dhcp4 || parsed;
      if (!dhcp4 || typeof dhcp4 !== 'object') {
        return { valid: false, error: 'Configuration must contain a valid Dhcp4 JSON object' };
      }
      return { valid: true };
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      return { valid: false, error: `Invalid JSON format: ${errMsg}` };
    }
  }

  async parseConfig(): Promise<ParsedConfig> {
    const dhcp4 = await keaService.getConfig();
    const raw = JSON.stringify({ Dhcp4: dhcp4 }, null, 2);

    const subnets: Subnet[] = (dhcp4.subnet4 || []).map((s: KeaSubnet4) => {
      const { baseIp, netmask, cidr } = parseSubnetCidr(s.subnet);
      let rangeStart = '';
      let rangeEnd = '';
      if (s.pools && s.pools.length > 0) {
        const poolStr = s.pools[0].pool || '';
        const parts = poolStr.split(/\s*-\s*/);
        rangeStart = parts[0] || '';
        rangeEnd = parts[1] || '';
      }

      const routersOpt = (s['option-data'] || []).find((o) => o.name === 'routers');
      const dnsOpt = (s['option-data'] || []).find((o) => o.name === 'domain-name-servers');
      const domainOpt = (s['option-data'] || []).find((o) => o.name === 'domain-name');

      const reservations: ScopeReservation[] = (s.reservations || []).map((r: KeaReservation, idx: number) => ({
        id: `${s.id || s.subnet}-${r['hw-address'] || idx}`,
        subnetId: s.id,
        name: r.hostname || `Host-${idx + 1}`,
        hostname: r.hostname || '',
        mac: r['hw-address'] || '',
        ip: r['ip-address'] || '',
        description: r.comments || ''
      }));

      return {
        id: s.id || s.subnet,
        name: s.comment || `Scope ${s.subnet}`,
        subnet: baseIp,
        subnetCidr: s.subnet,
        netmask,
        cidr,
        rangeStart,
        rangeEnd,
        routers: routersOpt ? routersOpt.data : '',
        domainNameServers: dnsOpt ? dnsOpt.data : '',
        domainName: domainOpt ? domainOpt.data : '',
        defaultLeaseTime: s['valid-lifetime'] || dhcp4['valid-lifetime'] || 4000,
        disabled: Boolean(s['user-context']?.disabled || s._disabled),
        reservations
      };
    });

    const allHosts = subnets.flatMap((s) => s.reservations || []);

    return {
      global: {
        defaultLeaseTime: dhcp4['valid-lifetime'] || 4000,
        renewTimer: dhcp4['renew-timer'] || 1000,
        rebindTimer: dhcp4['rebind-timer'] || 2000,
        authoritative: Boolean(dhcp4.authoritative)
      },
      subnets,
      hosts: allHosts,
      raw
    };
  }

  async getSubnets(): Promise<Subnet[]> {
    const configData = await this.parseConfig();
    return configData.subnets;
  }

  async getSubnetById(id: string | number): Promise<Subnet | undefined> {
    const subnets = await this.getSubnets();
    const strId = String(id);
    return subnets.find((s) => String(s.id) === strId || s.subnet === strId || s.subnetCidr === strId);
  }

  async createSubnet(data: SubnetInputData): Promise<Subnet | undefined> {
    const dhcp4 = await keaService.getConfig();
    if (!dhcp4.subnet4) {
      dhcp4.subnet4 = [];
    }

    const maxId = dhcp4.subnet4.reduce((max, s) => Math.max(max, parseInt(String(s.id), 10) || 0), 0);
    const newId = maxId + 1;

    const { subnet: cidrString } = parseSubnetCidr(data.subnet, data.netmask);

    // Build pools
    const pools = [];
    if (data.rangeStart && data.rangeEnd) {
      pools.push({ pool: `${data.rangeStart} - ${data.rangeEnd}` });
    }

    // Build option-data
    const optionData: KeaOptionData[] = [];
    if (data.routers) {
      optionData.push({ name: 'routers', data: data.routers });
    }
    if (data.domainNameServers) {
      optionData.push({ name: 'domain-name-servers', data: data.domainNameServers });
    }
    if (data.domainName) {
      optionData.push({ name: 'domain-name', data: data.domainName });
    }

    // Custom options
    if (Array.isArray(data.customOptions)) {
      data.customOptions.forEach((opt) => {
        const optVal = opt.data || opt.value;
        if (opt.name && optVal) {
          optionData.push({ name: opt.name, data: optVal });
        }
      });
    }

    const newSubnet: KeaSubnet4 = {
      id: newId,
      subnet: cidrString,
      comment: data.name || `Scope ${cidrString}`,
      pools,
      'option-data': optionData,
      reservations: []
    };

    if (data.defaultLeaseTime) {
      newSubnet['valid-lifetime'] = parseInt(String(data.defaultLeaseTime), 10);
    }
    if (data.disabled) {
      newSubnet['user-context'] = { disabled: true };
    }

    dhcp4.subnet4.push(newSubnet);

    await keaService.setConfig(dhcp4, `Added scope ${cidrString}`);
    return await this.getSubnetById(newId);
  }

  async updateSubnet(id: string | number, data: Partial<SubnetInputData>): Promise<Subnet | undefined> {
    const dhcp4 = await keaService.getConfig();
    if (!dhcp4.subnet4) {
      throw new Error('No subnets configured');
    }

    const strId = String(id);
    const index = dhcp4.subnet4.findIndex(
      (s) => String(s.id) === strId || s.subnet === strId
    );

    if (index === -1) {
      throw new Error(`Scope '${id}' not found`);
    }

    const current = dhcp4.subnet4[index];
    const { subnet: cidrString } = parseSubnetCidr(data.subnet || current.subnet, data.netmask);

    current.subnet = cidrString;
    if (data.name) current.comment = data.name;

    // Update pools
    if (data.rangeStart && data.rangeEnd) {
      current.pools = [{ pool: `${data.rangeStart} - ${data.rangeEnd}` }];
    } else if (data.rangeStart === '' && data.rangeEnd === '') {
      current.pools = [];
    }

    // Update option-data
    const optionData: KeaOptionData[] = [];
    const routers = data.routers !== undefined ? data.routers : (current['option-data'] || []).find((o) => o.name === 'routers')?.data;
    const dns = data.domainNameServers !== undefined ? data.domainNameServers : (current['option-data'] || []).find((o) => o.name === 'domain-name-servers')?.data;
    const domain = data.domainName !== undefined ? data.domainName : (current['option-data'] || []).find((o) => o.name === 'domain-name')?.data;

    if (routers) optionData.push({ name: 'routers', data: routers });
    if (dns) optionData.push({ name: 'domain-name-servers', data: dns });
    if (domain) optionData.push({ name: 'domain-name', data: domain });

    if (Array.isArray(data.customOptions)) {
      data.customOptions.forEach((opt) => {
        const optVal = opt.data || opt.value;
        if (opt.name && optVal) optionData.push({ name: opt.name, data: optVal });
      });
    }

    current['option-data'] = optionData;

    if (data.defaultLeaseTime) {
      current['valid-lifetime'] = parseInt(String(data.defaultLeaseTime), 10);
    }
    if (data.disabled !== undefined) {
      if (data.disabled) {
        current['user-context'] = { ...(current['user-context'] || {}), disabled: true };
      } else if (current['user-context']) {
        delete current['user-context'].disabled;
        if (Object.keys(current['user-context']).length === 0) {
          delete current['user-context'];
        }
      }
      delete current._disabled;
    }

    await keaService.setConfig(dhcp4, `Updated scope ${cidrString}`);
    return await this.getSubnetById(current.id);
  }

  async deleteSubnet(id: string | number): Promise<{ success: boolean; message: string }> {
    const dhcp4 = await keaService.getConfig();
    if (!dhcp4.subnet4) {
      throw new Error('No subnets configured');
    }

    const strId = String(id);
    const beforeCount = dhcp4.subnet4.length;
    dhcp4.subnet4 = dhcp4.subnet4.filter((s) => String(s.id) !== strId && s.subnet !== strId);

    if (dhcp4.subnet4.length === beforeCount) {
      throw new Error(`Scope '${id}' not found`);
    }

    await keaService.setConfig(dhcp4, `Deleted scope ${id}`);
    return { success: true, message: `Scope ${id} deleted successfully` };
  }

  async toggleSubnetDisabled(id: string | number): Promise<Subnet | undefined> {
    const dhcp4 = await keaService.getConfig();
    const strId = String(id);
    const subnet = (dhcp4.subnet4 || []).find((s) => String(s.id) === strId || s.subnet === strId);
    if (!subnet) {
      throw new Error(`Scope '${id}' not found`);
    }

    const isCurrentlyDisabled = Boolean(subnet['user-context']?.disabled || subnet._disabled);
    if (!isCurrentlyDisabled) {
      subnet['user-context'] = { ...(subnet['user-context'] || {}), disabled: true };
    } else if (subnet['user-context']) {
      delete subnet['user-context'].disabled;
      if (Object.keys(subnet['user-context']).length === 0) {
        delete subnet['user-context'];
      }
    }
    delete subnet._disabled;

    await keaService.setConfig(dhcp4, `Toggled status for scope ${id}`);
    return await this.getSubnetById(subnet.id);
  }

  /**
   * Reservation Management within a Subnet
   */
  async addReservation(
    subnetId: string | number,
    reservation: { hwAddress: string; ipAddress: string; hostname?: string },
    options: { overwrite?: boolean } = {}
  ): Promise<KeaReservation> {
    const { hwAddress, ipAddress, hostname } = reservation;
    if (!hwAddress || !ipAddress) {
      throw new Error('MAC address (hwAddress) and IP address are required');
    }

    const dhcp4 = await keaService.getConfig();
    const strId = String(subnetId);
    const subnet = (dhcp4.subnet4 || []).find((s) => String(s.id) === strId || s.subnet === strId);
    if (!subnet) {
      throw new Error(`Subnet '${subnetId}' not found`);
    }

    if (!subnet.reservations) {
      subnet.reservations = [];
    }

    const cleanMac = hwAddress.toLowerCase().trim();
    const cleanIp = ipAddress.trim();

    // Check if MAC or IP already reserved in this subnet
    const existingIndex = subnet.reservations.findIndex(
      (r) => (r['hw-address'] || '').toLowerCase() === cleanMac || r['ip-address'] === cleanIp
    );

    if (existingIndex !== -1) {
      if (options.overwrite) {
        // Remove all reservations matching this IP or MAC across subnets
        subnet.reservations = subnet.reservations.filter(
          (r) => (r['hw-address'] || '').toLowerCase() !== cleanMac && r['ip-address'] !== cleanIp
        );
      } else {
        const conflict = subnet.reservations[existingIndex];
        throw new Error(
          `Reservation conflict: IP ${cleanIp} or MAC ${cleanMac} is already reserved by ${conflict['hw-address']} (${conflict.hostname || 'unnamed'})`
        );
      }
    }

    const newRes: KeaReservation = {
      'hw-address': cleanMac,
      'ip-address': cleanIp,
      hostname: hostname ? hostname.trim() : ''
    };

    subnet.reservations.push(newRes);
    await keaService.setConfig(dhcp4, `Added reservation ${cleanMac} (${cleanIp}) in subnet ${subnet.id}`);
    return newRes;
  }

  async updateReservation(
    subnetId: string | number,
    targetHwAddress: string,
    updated: { hwAddress?: string; ipAddress?: string; hostname?: string }
  ): Promise<KeaReservation> {
    const dhcp4 = await keaService.getConfig();
    const strId = String(subnetId);
    const subnet = (dhcp4.subnet4 || []).find((s) => String(s.id) === strId || s.subnet === strId);
    if (!subnet) {
      throw new Error(`Subnet '${subnetId}' not found`);
    }

    const cleanTargetMac = targetHwAddress.toLowerCase().trim();
    const res = (subnet.reservations || []).find((r) => (r['hw-address'] || '').toLowerCase() === cleanTargetMac);
    if (!res) {
      throw new Error(`Reservation '${targetHwAddress}' not found in subnet ${subnetId}`);
    }

    if (updated.hwAddress) res['hw-address'] = updated.hwAddress.toLowerCase().trim();
    if (updated.ipAddress) res['ip-address'] = updated.ipAddress.trim();
    if (updated.hostname !== undefined) res.hostname = updated.hostname.trim();

    await keaService.setConfig(dhcp4, `Updated reservation ${cleanTargetMac} in subnet ${subnet.id}`);
    return res;
  }

  async deleteReservation(subnetId: string | number, targetHwAddress: string): Promise<{ success: boolean; message: string }> {
    const dhcp4 = await keaService.getConfig();
    const strId = String(subnetId);
    const subnet = (dhcp4.subnet4 || []).find((s) => String(s.id) === strId || s.subnet === strId);
    if (!subnet) {
      throw new Error(`Subnet '${subnetId}' not found`);
    }

    const cleanTargetMac = targetHwAddress.toLowerCase().trim();
    const beforeCount = (subnet.reservations || []).length;
    subnet.reservations = (subnet.reservations || []).filter(
      (r) => (r['hw-address'] || '').toLowerCase() !== cleanTargetMac
    );

    if (subnet.reservations.length === beforeCount) {
      throw new Error(`Reservation '${targetHwAddress}' not found in subnet ${subnetId}`);
    }

    await keaService.setConfig(dhcp4, `Deleted reservation ${cleanTargetMac} from subnet ${subnet.id}`);
    return { success: true, message: `Reservation for ${targetHwAddress} deleted successfully` };
  }

  async getGlobalSettings(): Promise<GlobalSettings> {
    const dhcp4 = await keaService.getConfig();
    const dnsOpt = (dhcp4['option-data'] || []).find((o) => o.name === 'domain-name-servers');
    const domainOpt = (dhcp4['option-data'] || []).find((o) => o.name === 'domain-name');

    return {
      defaultLeaseTime: dhcp4['valid-lifetime'] || 4000,
      renewTimer: dhcp4['renew-timer'] || 1000,
      rebindTimer: dhcp4['rebind-timer'] || 2000,
      domainNameServers: dnsOpt ? dnsOpt.data : '',
      domainName: domainOpt ? domainOpt.data : '',
      authoritative: Boolean(dhcp4.authoritative)
    };
  }

  async updateGlobalSettings(settings: Partial<GlobalSettings>): Promise<GlobalSettings> {
    const dhcp4 = await keaService.getConfig();

    if (settings.defaultLeaseTime) {
      dhcp4['valid-lifetime'] = parseInt(String(settings.defaultLeaseTime), 10);
    }
    if (settings.renewTimer) {
      dhcp4['renew-timer'] = parseInt(String(settings.renewTimer), 10);
    }
    if (settings.rebindTimer) {
      dhcp4['rebind-timer'] = parseInt(String(settings.rebindTimer), 10);
    }
    if (settings.authoritative !== undefined) {
      dhcp4.authoritative = Boolean(settings.authoritative);
    }

    if (!dhcp4['option-data']) {
      dhcp4['option-data'] = [];
    }

    if (settings.domainNameServers !== undefined) {
      const opt = dhcp4['option-data'].find((o) => o.name === 'domain-name-servers');
      if (opt) {
        opt.data = settings.domainNameServers;
      } else if (settings.domainNameServers) {
        dhcp4['option-data'].push({ name: 'domain-name-servers', data: settings.domainNameServers });
      }
    }

    if (settings.domainName !== undefined) {
      const opt = dhcp4['option-data'].find((o) => o.name === 'domain-name');
      if (opt) {
        opt.data = settings.domainName;
      } else if (settings.domainName) {
        dhcp4['option-data'].push({ name: 'domain-name', data: settings.domainName });
      }
    }

    await keaService.setConfig(dhcp4, 'Updated global Kea DHCP settings');
    return await this.getGlobalSettings();
  }
}

export default new DhcpConfigService();
