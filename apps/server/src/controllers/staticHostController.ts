import { Request, Response } from 'express';
import dhcpConfigService from '../services/dhcpConfigService';
import { MAC_REGEX, IPv4_REGEX } from '@kea/shared';

export class StaticHostController {
  async getStaticHosts(_req: Request, res: Response) {
    try {
      const configData = await dhcpConfigService.parseConfig();
      return res.json(configData.hosts || []);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: errMsg });
    }
  }

  async getStaticHostById(req: Request, res: Response) {
    try {
      const configData = await dhcpConfigService.parseConfig();
      const strId = String(req.params.id).toLowerCase();
      const host = (configData.hosts || []).find(
        (h) =>
          String(h.id).toLowerCase() === strId ||
          (h.mac && h.mac.toLowerCase() === strId) ||
          (h.name && h.name.toLowerCase() === strId)
      );
      if (!host) {
        return res.status(404).json({ error: `Host '${req.params.id}' not found` });
      }
      return res.json(host);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: errMsg });
    }
  }

  async createStaticHost(req: Request, res: Response) {
    const { name, mac, ip, subnetId } = req.body;

    if (!mac || !ip) {
      return res.status(400).json({ error: 'MAC address and Fixed IP are required' });
    }

    const cleanMac = String(mac).trim().replace(/-/g, ':').toLowerCase();
    if (!MAC_REGEX.test(cleanMac)) {
      return res.status(400).json({ error: 'Invalid MAC address format (expected e.g. 00:11:22:33:44:55)' });
    }

    const cleanIp = String(ip).trim();
    if (!IPv4_REGEX.test(cleanIp)) {
      return res.status(400).json({ error: 'Invalid IP address format' });
    }

    try {
      const subnets = await dhcpConfigService.getSubnets();
      if (!subnets.length) {
        return res.status(400).json({ error: 'No DHCP subnets configured. Please create a Scope first.' });
      }

      // Target specified subnet or default to first
      const targetSubnet = subnetId
        ? subnets.find((s) => String(s.id) === String(subnetId)) || subnets[0]
        : subnets[0];

      const created = await dhcpConfigService.addReservation(targetSubnet.id, {
        hwAddress: cleanMac,
        ipAddress: cleanIp,
        hostname: name ? String(name).trim() : ''
      });
      return res.status(201).json(created);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ error: errMsg });
    }
  }
}

export default new StaticHostController();
