const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const dhcpConfigService = require('../services/dhcpConfigService');

// GET /api/scopes
router.get('/', authMiddleware, async (req, res) => {
  try {
    const subnets = await dhcpConfigService.getSubnets();
    res.json(subnets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/scopes/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const subnet = await dhcpConfigService.getSubnetById(req.params.id);
    if (!subnet) {
      return res.status(404).json({ error: `Scope '${req.params.id}' not found` });
    }
    res.json(subnet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/scopes
router.post('/', authMiddleware, async (req, res) => {
  const { name, subnet, netmask, rangeStart, rangeEnd, routers, domainNameServers, domainName, defaultLeaseTime, disabled } = req.body;
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
      defaultLeaseTime: defaultLeaseTime ? parseInt(defaultLeaseTime, 10) : '',
      customOptions: Array.isArray(req.body.customOptions) ? req.body.customOptions : []
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/scopes/:id/toggle
router.patch('/:id/toggle', authMiddleware, async (req, res) => {
  try {
    const updated = await dhcpConfigService.toggleSubnetDisabled(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/scopes/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const updated = await dhcpConfigService.updateSubnet(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/scopes/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await dhcpConfigService.deleteSubnet(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Scope Reservations (Static Hosts) Endpoints ---

// POST /api/scopes/:id/reservations
router.post('/:id/reservations', authMiddleware, async (req, res) => {
  const { hwAddress, mac, ipAddress, ip, hostname, name } = req.body;
  const targetMac = hwAddress || mac;
  const targetIp = ipAddress || ip;
  const targetHost = hostname || name;

  if (!targetMac || !targetIp) {
    return res.status(400).json({ error: 'MAC address and IP address are required' });
  }

  // MAC validation
  const macRegex = /^([0-9a-fA-F]{2}[:-]){5}([0-9a-fA-F]{2})$/;
  if (!macRegex.test(targetMac)) {
    return res.status(400).json({ error: 'Invalid MAC address format (expected XX:XX:XX:XX:XX:XX)' });
  }

  try {
    const created = await dhcpConfigService.addReservation(req.params.id, {
      hwAddress: targetMac,
      ipAddress: targetIp,
      hostname: targetHost || ''
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/scopes/:id/reservations/:hwAddress
router.put('/:id/reservations/:hwAddress', authMiddleware, async (req, res) => {
  const { hwAddress, mac, ipAddress, ip, hostname, name } = req.body;
  const newMac = hwAddress || mac;
  const newIp = ipAddress || ip;
  const newHost = hostname !== undefined ? hostname : name;

  try {
    const updated = await dhcpConfigService.updateReservation(req.params.id, req.params.hwAddress, {
      hwAddress: newMac,
      ipAddress: newIp,
      hostname: newHost
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/scopes/:id/reservations/:hwAddress
router.delete('/:id/reservations/:hwAddress', authMiddleware, async (req, res) => {
  try {
    const result = await dhcpConfigService.deleteReservation(req.params.id, req.params.hwAddress);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
