const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const dhcpConfigService = require('../services/dhcpConfigService');
const dhcpLeaseService = require('../services/dhcpLeaseService');
const systemService = require('../services/systemService');

function ipToInt(ip) {
  if (!ip) return 0;
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function calculateRangeCapacity(start, end) {
  if (!start || !end) return 0;
  try {
    const s = ipToInt(start);
    const e = ipToInt(end);
    return Math.max(0, e - s + 1);
  } catch (e) {
    return 0;
  }
}

function isIpInRange(ip, start, end) {
  if (!ip || !start || !end) return false;
  try {
    const target = ipToInt(ip);
    return target >= ipToInt(start) && target <= ipToInt(end);
  } catch (e) {
    return false;
  }
}

// GET /api/dashboard
router.get('/', authMiddleware, async (req, res) => {
  try {
    const serviceStatus = systemService.getServiceStatus();
    const configData = await dhcpConfigService.parseConfig();
    const leases = await dhcpLeaseService.getLeases();

    const activeLeases = leases.filter((l) => l.status === 'active');
    const expiredLeases = leases.filter((l) => l.status === 'expired');

    let totalPoolCapacity = 0;
    const subnetStats = configData.subnets.map((s) => {
      const capacity = calculateRangeCapacity(s.rangeStart, s.rangeEnd);
      totalPoolCapacity += capacity;

      const activeInSubnet = activeLeases.filter((l) => isIpInRange(l.ip, s.rangeStart, s.rangeEnd)).length;
      const utilization = capacity > 0 ? Math.round((activeInSubnet / capacity) * 100) : 0;

      return {
        id: s.id,
        subnet: s.subnet,
        netmask: s.netmask,
        cidr: s.cidr,
        range: s.rangeStart && s.rangeEnd ? `${s.rangeStart} - ${s.rangeEnd}` : 'N/A',
        capacity,
        reservationsCount: (s.reservations || []).length,
        activeLeases: activeInSubnet,
        utilization
      };
    });

    const overallUtilization = totalPoolCapacity > 0
      ? Math.round((activeLeases.length / totalPoolCapacity) * 100)
      : 0;

    res.json({
      service: serviceStatus,
      counts: {
        subnets: configData.subnets.length,
        staticHosts: configData.hosts.length,
        activeLeases: activeLeases.length,
        expiredLeases: expiredLeases.length,
        totalCapacity: totalPoolCapacity,
        utilizationPercentage: overallUtilization
      },
      subnetStats,
      recentLeases: leases.slice(0, 5)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
