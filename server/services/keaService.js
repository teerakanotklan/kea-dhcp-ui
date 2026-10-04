const fs = require('fs');
const http = require('http');
const config = require('../config/default');
const backupService = require('./backupService');

class KeaService {
  constructor() {
    this.agentUrl = config.keaCtrlAgentUrl;
    this.confPath = config.confPath;
  }

  /**
   * Send JSON command to Kea Control Agent
   */
  async sendCommand(command, service = ['dhcp4'], args = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.agentUrl);
      const payload = {
        command,
        service: Array.isArray(service) ? service : [service]
      };
      if (args && typeof args === 'object' && Object.keys(args).length > 0) {
        payload.arguments = args;
      }
      const postData = JSON.stringify(payload);

      const options = {
        hostname: url.hostname,
        port: url.port || 8000,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 5000
      };

      const req = http.request(options, (res) => {
        let rawData = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(rawData);
            // Kea returns array of responses: [ { result: 0, text: "...", arguments: { ... } } ]
            if (Array.isArray(parsed) && parsed.length > 0) {
              const firstRes = parsed[0];
              if (firstRes.result === 0) {
                resolve(firstRes.arguments || {});
              } else if (firstRes.result === 3) {
                // Kea returns result 3 for "0 items found" (e.g. lease4-get-all)
                resolve(firstRes.arguments || {});
              } else {
                reject(new Error(firstRes.text || `Kea command '${command}' returned error code ${firstRes.result}`));
              }
            } else {
              resolve(parsed);
            }
          } catch (e) {
            reject(new Error(`Failed to parse Kea Control Agent response: ${rawData.slice(0, 100)}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Kea Control Agent connection timed out'));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Check if Kea Control Agent is alive
   */
  async isAgentAvailable() {
    try {
      await this.sendCommand('status-get', ['dhcp4']);
      return true;
    } catch (e) {
      try {
        await this.sendCommand('version-get');
        return true;
      } catch (err) {
        return false;
      }
    }
  }

  /**
   * Fetch running configuration for Dhcp4
   */
  async getConfig() {
    try {
      const res = await this.sendCommand('config-get', ['dhcp4']);
      if (res && res.Dhcp4) {
        return res.Dhcp4;
      }
      throw new Error('Config missing Dhcp4 element in response');
    } catch (err) {
      // Fallback: read directly from config file on disk
      if (fs.existsSync(this.confPath)) {
        try {
          const raw = fs.readFileSync(this.confPath, 'utf8');
          const json = JSON.parse(raw);
          return json.Dhcp4 || json;
        } catch (e) {
          throw new Error(`Failed to read Kea config file: ${e.message}`);
        }
      }
      throw new Error(`Kea Control Agent unreachable and config file not found: ${err.message}`);
    }
  }

  /**
   * Apply modified Dhcp4 configuration to Kea runtime and persist to disk
   */
  async setConfig(dhcp4Config, comment = 'Updated via Web UI') {
    // 1. Auto backup current configuration on disk
    if (fs.existsSync(this.confPath)) {
      try {
        backupService.createBackup(this.confPath, comment);
      } catch (e) {
        // backup failure should not block applying config
      }
    }

    // 2. Try applying via Kea Control Agent runtime
    let agentOk = false;
    try {
      await this.sendCommand('config-set', ['dhcp4'], { Dhcp4: dhcp4Config });
      agentOk = true;

      // Persist to disk using Kea's config-write
      try {
        await this.sendCommand('config-write', ['dhcp4'], { filename: this.confPath });
      } catch (writeErr) {
        // If config-write not supported or failed, write to file directly
        this.writeConfigFile(dhcp4Config);
      }
    } catch (agentErr) {
      // Fallback: write to file directly on disk
      this.writeConfigFile(dhcp4Config);
    }

    return {
      success: true,
      appliedViaAgent: agentOk,
      message: 'Configuration applied and saved successfully'
    };
  }

  /**
   * Write JSON configuration directly to file on disk
   */
  writeConfigFile(dhcp4Config) {
    const fullJson = { Dhcp4: dhcp4Config };
    fs.writeFileSync(this.confPath, JSON.stringify(fullJson, null, 2), 'utf8');
  }

  /**
   * Fetch all active leases from Kea
   */
  async getAllLeases() {
    try {
      const res = await this.sendCommand('lease4-get-all', ['dhcp4']);
      return res.leases || [];
    } catch (err) {
      // Fallback: if leases CSV exists, parse from CSV
      const csvPath = '/var/lib/kea/kea-leases4.csv';
      if (fs.existsSync(csvPath)) {
        return this.parseLeasesCsv(csvPath);
      }
      return [];
    }
  }

  /**
   * Delete / Release lease by IP address
   */
  async releaseLease(ipAddress) {
    try {
      await this.sendCommand('lease4-del', ['dhcp4'], { 'ip-address': ipAddress });
      return { success: true, message: `Lease for ${ipAddress} released` };
    } catch (err) {
      throw new Error(`Failed to release lease: ${err.message}`);
    }
  }

  /**
   * Fallback CSV parser for Kea Memfile leases
   */
  parseLeasesCsv(csvPath) {
    try {
      const content = fs.readFileSync(csvPath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      if (lines.length <= 1) return [];

      const headers = lines[0].split(',').map(h => h.trim());
      const leaseMap = new Map();

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim());
        const obj = {};
        headers.forEach((h, idx) => {
          obj[h] = parts[idx];
        });

        const ip = obj.address || obj['ip-address'];
        if (!ip) continue;

        const validLft = parseInt(obj.valid_lifetime || obj['valid-lft'] || 0, 10);
        const expire = parseInt(obj.expire || 0, 10);
        const cltt = parseInt(obj.cltt || (expire && validLft ? expire - validLft : expire) || 0, 10);

        const current = {
          'ip-address': ip,
          'hw-address': obj.hwaddr || obj['hw-address'] || '',
          'valid-lft': validLft,
          'cltt': cltt,
          'hostname': obj.hostname || '',
          'state': parseInt(obj.state || 0, 10),
          'subnet-id': parseInt(obj.subnet_id || obj['subnet-id'] || 1, 10)
        };

        const existing = leaseMap.get(ip);
        if (!existing || (current.cltt > existing.cltt)) {
          leaseMap.set(ip, current);
        }
      }
      return Array.from(leaseMap.values());
    } catch (e) {
      return [];
    }
  }
}

module.exports = new KeaService();
