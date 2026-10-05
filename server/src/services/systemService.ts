import { execSync, execFileSync } from 'child_process';
import config from '../config/default';
import { DhcpServiceStatus, ServiceDaemonStatus, ServiceAction } from '../../../shared/types/service';
import { ServiceLogEntry, LogLevel } from '../../../shared/types/logs';

function checkSystemdService(serviceName: string): ServiceDaemonStatus {
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
  } catch (err: unknown) {
    const errorObj = err as { stdout?: string | Buffer; stderr?: string | Buffer; message?: string };
    const output = ((errorObj.stdout || '') + '\n' + (errorObj.stderr || '')).trim();
    const isActive = output.includes('Active: active (running)');
    const pidMatch = output.match(/Main PID:\s+(\d+)/);
    const sinceMatch = output.match(/Active: active \(running\) since (.+);/);

    return {
      service: serviceName,
      active: isActive,
      status: isActive ? 'active (running)' : 'inactive (dead)',
      pid: pidMatch ? parseInt(pidMatch[1], 10) : null,
      since: sinceMatch ? sinceMatch[1] : null,
      raw: output || errorObj.message || 'Error executing systemctl status',
      error: errorObj.message
    };
  }
}

export class SystemService {
  private dhcpService: string;
  private ctrlAgentService: string;

  constructor() {
    this.dhcpService = config.dhcpService;
    this.ctrlAgentService = config.ctrlAgentService;
  }

  getServiceStatus(): DhcpServiceStatus {
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

  controlService(action: ServiceAction, target = 'all'): { success: boolean; message: string } {
    const validActions: ServiceAction[] = ['restart', 'reload', 'stop', 'start'];
    if (!validActions.includes(action)) {
      throw new Error(`Invalid service action: ${action}`);
    }

    const servicesToControl: string[] = [];
    if (target === 'dhcp4' || target === 'dhcp') {
      servicesToControl.push(this.dhcpService);
    } else if (target === 'ctrl-agent' || target === 'agent') {
      servicesToControl.push(this.ctrlAgentService);
    } else {
      servicesToControl.push(this.dhcpService, this.ctrlAgentService);
    }

    const results: string[] = [];
    for (const sName of servicesToControl) {
      try {
        execSync(`sudo systemctl ${action} ${sName}`, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        results.push(`${sName}: ${action} OK`);
      } catch (err: unknown) {
        const errorObj = err as { stdout?: string | Buffer; stderr?: string | Buffer; message?: string };
        const errMsg = (errorObj.stderr || errorObj.stdout || errorObj.message || '').toString().trim();
        throw new Error(`Failed to ${action} ${sName}: ${errMsg}`);
      }
    }

    return {
      success: true,
      message: results.join(', ')
    };
  }

  validateDhcpConfig(customPath: string | null = null): { success: boolean; output?: string; error?: string } {
    const pathToCheck = customPath || config.confPath;

    try {
      const output = execFileSync('sudo', [config.helperPath, 'validate', pathToCheck], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return { success: true, output };
    } catch (err: unknown) {
      const errorObj = err as { stdout?: string | Buffer; stderr?: string | Buffer; message?: string };
      const errorText = (errorObj.stdout || errorObj.stderr || errorObj.message || '').toString().trim();
      return { success: false, error: errorText };
    }
  }

  getLogs(service = 'all', limit: number | string = 100): ServiceLogEntry[] {
    try {
      const safeLimit = Math.min(Math.max(parseInt(String(limit), 10) || 100, 1), 500);
      let which = 'all';
      const s = (service || 'all').toLowerCase();
      if (s === 'ctrl-agent' || s === 'agent' || s === 'kea-ctrl-agent') {
        which = 'agent';
      } else if (s === 'dhcp4' || s === 'dhcp' || s === 'kea-dhcp4' || s === 'kea-dhcp4-server') {
        which = 'dhcp4';
      }

      const output = execFileSync('sudo', [config.helperPath, 'logs', which, String(safeLimit)], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const lines = output.trim().split('\n').filter(Boolean);
      const parsedLogs: ServiceLogEntry[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let timestamp = line.slice(0, 15).trim();
        let svc = 'kea-dhcp4';
        let level: LogLevel = 'INFO';
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

        // Strict Filter: Only include log lines originating from Kea daemons
        const isKeaDaemon = svc.includes('dhcp4') || svc.includes('ctrl-agent') || svc.startsWith('kea-');
        const hasKeaFormat = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(payload) || payload.includes('[kea-');

        if (!isKeaDaemon && !hasKeaFormat) {
          continue; // Discard non-Kea lines (e.g. pam_unix, sudo, systemd lifecycle)
        }

        if (svc.includes('ctrl-agent')) svc = 'kea-ctrl-agent';
        else svc = 'kea-dhcp4';

        // Parse Kea internal log: "2026-10-04 21:41:25.909 INFO  [kea-dhcp4.commands/4217.134261230369216] COMMAND_RECEIVED Received command 'lease4-get-all'"
        const keaMatch = payload.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+(INFO|WARN|WARNING|ERROR|FATAL|DEBUG)\s+\[([^\]]+)\]\s+(?:([A-Z0-9_]+)\s+)?(.*)$/);
        if (keaMatch) {
          timestamp = keaMatch[1];
          const rawLvl = keaMatch[2];
          level = (rawLvl === 'WARNING' ? 'WARN' : (rawLvl === 'FATAL' ? 'ERROR' : rawLvl)) as LogLevel;
          event = keaMatch[4] || 'INFO';
          message = keaMatch[5] || '';
          if (keaMatch[3].startsWith('kea-ctrl-agent')) {
            svc = 'kea-ctrl-agent';
          } else if (keaMatch[3].startsWith('kea-dhcp4')) {
            svc = 'kea-dhcp4';
          }
        } else {
          // If a line doesn't match standard Kea format but is from Kea daemon (e.g. startup/critical notice)
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

        parsedLogs.push({
          id: `log-${parsedLogs.length}`,
          timestamp,
          service: svc,
          level,
          event,
          message,
          raw: line
        });
      }

      return parsedLogs;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return [
        {
          id: 'log-err-0',
          timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
          service: 'system',
          level: 'WARN',
          event: 'SYSTEM_NOTICE',
          message: `Notice: System logs query unavailable (${errMsg}). Verify sudoers permissions.`,
          raw: errMsg
        }
      ];
    }
  }
}

export default new SystemService();
