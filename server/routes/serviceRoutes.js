const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const systemService = require('../services/systemService');
const dhcpConfigService = require('../services/dhcpConfigService');

// GET /api/service/status
router.get('/status', authMiddleware, (req, res) => {
  try {
    const status = systemService.getServiceStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/service/settings
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    const settings = await dhcpConfigService.getGlobalSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/service/settings
router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const updated = await dhcpConfigService.updateGlobalSettings(req.body);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/service/control
router.post('/control', authMiddleware, (req, res) => {
  const { action, target } = req.body;
  if (!action) {
    return res.status(400).json({ error: 'Action is required (restart, reload, stop, start)' });
  }

  try {
    const result = systemService.controlService(action, target || 'all');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/service/logs
router.get('/logs', authMiddleware, (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const target = req.query.service || 'all';
    const logs = systemService.getLogs(target, limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
