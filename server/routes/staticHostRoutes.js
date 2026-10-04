const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const dhcpConfigService = require('../services/dhcpConfigService');

const MAC_REGEX = /^([0-9a-fA-F]{2}[:-]){5}([0-9a-fA-F]{2})$/;
const IP_REGEX = /^([0-9]{1,3}\.){3}[0-9]{1,3}$/;

// GET /api/static-hosts
router.get('/', authMiddleware, async (req, res) => {
  try {
    const configData = await dhcpConfigService.parseConfig();
    res.json(configData.hosts || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/static-hosts/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const configData = await dhcpConfigService.parseConfig();
    const strId = String(req.params.id).toLowerCase();
    const host = (configData.hosts || []).find(
      (h) => String(h.id).toLowerCase() === strId ||
             (h.mac && h.mac.toLowerCase() === strId) ||
             (h.name && h.name.toLowerCase() === strId)
    );
    if (!host) {
      return res.status(404).json({ error: `Host '${req.params.id}' not found` });
    }
    res.json(host);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/static-hosts
router.post('/', authMiddleware, async (req, res) => {
  const { name, mac, ip, description, subnetId } = req.body;

  if (!mac || !ip) {
    return res.status(400).json({ error: 'MAC address and Fixed IP are required' });
  }

  const cleanMac = mac.trim().replace(/-/g, ':').toLowerCase();
  if (!MAC_REGEX.test(cleanMac)) {
    return res.status(400).json({ error: 'Invalid MAC address format (expected e.g. 00:11:22:33:44:55)' });
  }

  const cleanIp = ip.trim();
  if (!IP_REGEX.test(cleanIp)) {
    return res.status(400).json({ error: 'Invalid IP address format' });
  }

  try {
    const subnets = await dhcpConfigService.getSubnets();
    if (!subnets.length) {
      return res.status(400).json({ error: 'No DHCP subnets configured. Please create a Scope first.' });
    }

    // Target specified subnet or default to first
    const targetSubnet = subnetId ? (subnets.find((s) => String(s.id) === String(subnetId)) || subnets[0]) : subnets[0];
    const created = await dhcpConfigService.addReservation(targetSubnet.id, {
      hwAddress: cleanMac,
      ipAddress: cleanIp,
      hostname: name ? name.trim() : ''
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
