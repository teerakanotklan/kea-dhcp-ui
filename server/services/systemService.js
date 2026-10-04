const { execSync } = require('child_process');
const config = require('../config/default');
const keaService = require('./keaService');

function checkSystemdService(serviceName) {
  try {
    const output = execSync(`sudo systemctl status ${serviceName}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const isActive = output.includes('Active: active (running)');
    const pidMatch = output.match(/Main PID:\s+(\d+)/);
    const sinceMatch = output.match(/Active: active \(running\) since (.+);/);

    return {
      service: serviceName,
      active: isActive,
      status: isActive ? 'active (running)' : 'inactive',
      pid: pidMatch ? parseInt(pidMatch[1], 10) : null,
      since: sinceMatch ? sinceMatch[1] : null,
      raw: output
    };
  } catch (err) {
    const output = ((err.stdout || '') + '\n' + (err.stderr || '')).trim();
    const isActive = output.includes('Active: active (running)');
    const pidMatch = output.match(/Main PID:\s+(\d+)/);
    const sinceMatch = output.match(/Active: active \(running\) since (.+);/);

    return {
      service: serviceName,
      active: isActive,
      status: isActive ? 'active (running)' : 'inactive (dead)',
      pid: pidMatch ? parseInt(pidMatch[1], 10) : null,
      since: sinceMatch ? sinceMatch[1] : null,
      raw: output || err.message,
      error: err.message
    };
  }
}

class SystemService {
  constructor() {
    this.dhcpService = config.dhcpService;
    this.ctrlAgentService = config.ctrlAgentService;
  }

  getServiceStatus() {
    const dhcpStatus = checkSystemdService(this.dhcpService);
    const ctrlAgentStatus = checkSystemdService(this.ctrlAgentService);

    const overallActive = dhcpStatus.active && ctrlAgentStatus.active;

    return {
      service: `${this.dhcpService} & ${this.ctrlAgentService}`,
      active: overallActive,
      status: overallActive ? 'active (running)' : (dhcpStatus.active ? 'degraded (ctrl-agent inactive)' : 'inactive'),
      pid: dhcpStatus.pid,
      since: dhcpStatus.since,
      dhcp4: dhcpStatus,
      ctrlAgent: ctrlAgentStatus
    };
  }

  controlService(action, target = 'all') {
    const validActions = ['restart', 'reload', 'stop', 'start'];
    if (!validActions.includes(action)) {
      throw new Error(`Invalid service action: ${action}`);
    }

    const servicesToControl = [];
    if (target === 'dhcp4' || target === 'dhcp') {
      servicesToControl.push(this.dhcpService);
    } else if (target === 'ctrl-agent' || target === 'agent') {
      servicesToControl.push(this.ctrlAgentService);
    } else {
      servicesToControl.push(this.dhcpService, this.ctrlAgentService);
    }

    const results = [];
    for (const sName of servicesToControl) {
      try {
        execSync(`sudo systemctl ${action} ${sName}`, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        results.push(`${sName}: ${action} OK`);
      } catch (err) {
        const errMsg = (err.stderr || err.stdout || err.message).toString().trim();
        throw new Error(`Failed to ${action} ${sName}: ${errMsg}`);
      }
    }

    return {
      success: true,
      message: results.join(', ')
    };
  }

  validateDhcpConfig(customPath = null) {
    const pathToCheck = customPath || config.confPath;

    try {
      const output = execSync(`sudo kea-dhcp4 -t "${pathToCheck}" 2>&1`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return { success: true, output };
    } catch (err) {
      const errorText = (err.stdout || err.stderr || err.message).toString().trim();
      return { success: false, error: errorText };
    }
  }

  getLogs(service = 'all', limit = 100) {
    try {
      const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
      let unitFlags = `-u ${this.dhcpService}`;
      const s = (service || 'all').toLowerCase();
      if (s === 'ctrl-agent' || s === 'agent' || s === 'kea-ctrl-agent') {
        unitFlags = `-u ${this.ctrlAgentService}`;
      } else if (s === 'ui' || s === 'kea-dhcp-ui' || s === 'isc-dhcp-ui') {
        unitFlags = `-u kea-dhcp-ui`;
      } else if (s === 'dhcp4' || s === 'dhcp' || s === 'kea-dhcp4' || s === 'kea-dhcp4-server') {
        unitFlags = `-u ${this.dhcpService}`;
      } else if (s === 'all') {
        unitFlags = `-u ${this.dhcpService} -u ${this.ctrlAgentService} -u kea-dhcp-ui`;
      }

      const output = execSync(`sudo journalctl ${unitFlags} -n ${safeLimit} --no-pager`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const lines = output.trim().split('\n').filter(Boolean);
      return lines.map((line, index) => {
        let timestamp = line.slice(0, 15).trim();
        let svc = 'kea-dhcp4';
        let level = 'INFO';
        let event = 'GENERAL';
        let message = line;

        // Parse Syslog prefix: e.g. "Oct 04 21:41:25 CT111 kea-dhcp4[4217]: ..."
        const syslogMatch = line.match(/^([A-Za-z]{3}\s+\d+\s+\d{2}:\d{2}:\d{2})\s+[\w-]+\s+([\w-]+)(?:\[\d+\])?:\s*(.*)$/);
        let payload = line;
        if (syslogMatch) {
          timestamp = syslogMatch[1];
          svc = syslogMatch[2];
          payload = syslogMatch[3];
        }

        if (svc.includes('ctrl-agent')) svc = 'kea-ctrl-agent';
        else if (svc.includes('dhcp4')) svc = 'kea-dhcp4';
        else if (svc.includes('kea-dhcp-ui') || svc.includes('node')) svc = 'kea-dhcp-ui';

        // Parse Kea internal log: "2026-10-04 21:41:25.909 INFO  [kea-dhcp4.commands/4217.134261230369216] COMMAND_RECEIVED Received command 'lease4-get-all'"
        const keaMatch = payload.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+(INFO|WARN|WARNING|ERROR|FATAL|DEBUG)\s+\[([^\]]+)\]\s+(?:([A-Z0-9_]+)\s+)?(.*)$/);
        if (keaMatch) {
          timestamp = keaMatch[1];
          const rawLvl = keaMatch[2];
          level = rawLvl === 'WARNING' ? 'WARN' : (rawLvl === 'FATAL' ? 'ERROR' : rawLvl);
          event = keaMatch[4] || 'INFO';
          message = keaMatch[5] || '';
        } else {
          if (/error|failed|failure|fatal|crit/i.test(payload)) {
            level = 'ERROR';
          } else if (/warn/i.test(payload)) {
            level = 'WARN';
          } else if (/debug/i.test(payload)) {
            level = 'DEBUG';
          } else {
            level = 'INFO';
          }

          const tagMatch = payload.match(/^([A-Z0-9_]+):\s*(.*)$/);
          if (tagMatch) {
            event = tagMatch[1];
            message = tagMatch[2];
          } else {
            event = svc.toUpperCase();
            message = payload;
          }
        }

        return {
          id: `log-${index}`,
          timestamp,
          service: svc,
          level,
          event,
          message,
          raw: line
        };
      });
    } catch (err) {
      return [
        {
          id: 'log-err-0',
          timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
          service: 'system',
          level: 'WARN',
          event: 'SYSTEM_NOTICE',
          message: `Notice: System logs query unavailable (${err.message}). Verify sudoers permissions.`,
          raw: err.message
        }
      ];
    }
  }
}

module.exports = new SystemService();
