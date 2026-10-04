const keaService = require('./keaService');

class DhcpLeaseService {
  async getLeases() {
    try {
      const rawLeases = await keaService.getAllLeases();
      const now = Date.now();

      const leases = rawLeases.map((l) => {
        const ip = l['ip-address'] || l.ip || '';
        const mac = (l['hw-address'] || l.mac || '').toLowerCase();
        const hostname = l.hostname || '';
        const cltt = parseInt(l.cltt || 0, 10);
        const validLft = parseInt(l['valid-lft'] || l.validLft || 0, 10);

        let starts = null;
        let ends = null;
        let remainingSeconds = 0;
        let status = 'active';

        if (cltt > 0) {
          const startTimeMs = cltt * 1000;
          starts = new Date(startTimeMs).toISOString();

          if (validLft > 0) {
            const endTimeMs = (cltt + validLft) * 1000;
            ends = new Date(endTimeMs).toISOString();
            remainingSeconds = Math.max(0, Math.floor((endTimeMs - now) / 1000));
            if (endTimeMs < now) {
              status = 'expired';
            }
          }
        }

        // Kea state 0: active, 1: declining, 2: reclaimed
        if (l.state === 1) status = 'declining';
        if (l.state === 2) status = 'reclaimed';

        return {
          ip,
          mac,
          hostname,
          bindingState: status,
          status,
          starts,
          ends,
          remainingSeconds,
          subnetId: l['subnet-id'] || 1
        };
      });

      return leases.sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return a.ip.localeCompare(b.ip, undefined, { numeric: true });
      });
    } catch (err) {
      return [];
    }
  }

  async releaseLease(ip) {
    if (!ip) {
      throw new Error('IP address is required');
    }
    return await keaService.releaseLease(ip);
  }
}

module.exports = new DhcpLeaseService();
