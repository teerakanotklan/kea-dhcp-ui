import { Request, Response } from 'express';
import dhcpConfigService from '../services/dhcpConfigService';
import { MAC_REGEX } from '@kea/shared';

export class ScopeController {
  async getScopes(_req: Request, res: Response) {
    try {
      const subnets = await dhcpConfigService.getSubnets();
      return res.json(subnets);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: errMsg });
    }
  }

  async getScopeById(req: Request, res: Response) {
    try {
      const subnet = await dhcpConfigService.getSubnetById(req.params.id);
      if (!subnet) {
        return res.status(404).json({ error: `Scope '${req.params.id}' not found` });
      }
      return res.json(subnet);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: errMsg });
    }
  }

  async createScope(req: Request, res: Response) {
    const {
      name,
      subnet,
      netmask,
      rangeStart,
      rangeEnd,
      routers,
      domainNameServers,
      domainName,
      defaultLeaseTime,
      disabled
    } = req.body;

    if (!subnet) {
      return res.status(400).json({ error: 'Subnet CIDR or network IP is required' });
    }

    try {
      const created = await dhcpConfigService.createSubnet({
        name: String(name || '').trim(),
        subnet,
        netmask,
        disabled: Boolean(disabled),
        rangeStart: rangeStart || '',
        rangeEnd: rangeEnd || '',
        routers: routers || '',
        domainNameServers: domainNameServers || '',
        domainName: domainName || '',
        defaultLeaseTime: defaultLeaseTime ? parseInt(String(defaultLeaseTime), 10) : undefined,
        customOptions: Array.isArray(req.body.customOptions) ? req.body.customOptions : []
      });
      return res.status(201).json(created);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ error: errMsg });
    }
  }

  async toggleScope(req: Request, res: Response) {
    try {
      const updated = await dhcpConfigService.toggleSubnetDisabled(req.params.id);
      return res.json(updated);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ error: errMsg });
    }
  }

  async updateScope(req: Request, res: Response) {
    try {
      const updated = await dhcpConfigService.updateSubnet(req.params.id, req.body);
      return res.json(updated);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ error: errMsg });
    }
  }

  async deleteScope(req: Request, res: Response) {
    try {
      const result = await dhcpConfigService.deleteSubnet(req.params.id);
      return res.json(result);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ error: errMsg });
    }
  }

  // --- Scope Reservations (Static Hosts) Handlers ---

  async addReservation(req: Request, res: Response) {
    const { hwAddress, mac, ipAddress, ip, hostname, name } = req.body;
    const targetMac = hwAddress || mac;
    const targetIp = ipAddress || ip;
    const targetHost = hostname || name;

    if (!targetMac || !targetIp) {
      return res.status(400).json({ error: 'MAC address and IP address are required' });
    }

    const cleanMac = String(targetMac).trim().replace(/-/g, ':').toLowerCase();
    if (!MAC_REGEX.test(cleanMac)) {
      return res.status(400).json({ error: 'Invalid MAC address format (expected XX:XX:XX:XX:XX:XX)' });
    }

    try {
      const created = await dhcpConfigService.addReservation(req.params.id, {
        hwAddress: cleanMac,
        ipAddress: String(targetIp).trim(),
        hostname: targetHost ? String(targetHost).trim() : ''
      });
      return res.status(201).json(created);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ error: errMsg });
    }
  }

  async updateReservation(req: Request, res: Response) {
    const { hwAddress, mac, ipAddress, ip, hostname, name } = req.body;
    const newMac = hwAddress || mac;
    const newIp = ipAddress || ip;
    const newHost = hostname !== undefined ? hostname : name;

    try {
      const updated = await dhcpConfigService.updateReservation(req.params.id, req.params.hwAddress, {
        hwAddress: newMac ? String(newMac).trim().replace(/-/g, ':').toLowerCase() : undefined,
        ipAddress: newIp ? String(newIp).trim() : undefined,
        hostname: newHost !== undefined ? String(newHost).trim() : undefined
      });
      return res.json(updated);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ error: errMsg });
    }
  }

  async deleteReservation(req: Request, res: Response) {
    try {
      const result = await dhcpConfigService.deleteReservation(req.params.id, req.params.hwAddress);
      return res.json(result);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ error: errMsg });
    }
  }
}

export default new ScopeController();
