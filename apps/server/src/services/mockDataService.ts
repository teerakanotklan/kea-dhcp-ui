import fs from 'fs';
import path from 'path';
import config from '../config/default';
import { KeaDhcp4Config, KeaRawLease, DhcpServiceStatus, ServiceDaemonStatus, ServiceAction, ServiceLogEntry, LogLevel } from '@kea/shared';

export class MockDataService {
  private dhcp4Active = true;
  private ctrlAgentActive = true;
  private startTime = Date.now() - 3600 * 1000 * 4; // Started 4 hours ago
  private dhcp4Pid = 14205;
  private ctrlAgentPid = 14206;
  private mockLeases: KeaRawLease[] = [];

  constructor() {
    this.initMockLeases();
    this.ensureSampleConfigFile();
  }

  /**
   * Ensure a valid sample kea-dhcp4.conf exists in dataDir for local simulation
   */
  private ensureSampleConfigFile(): void {
    const targetFile = config.confPath;
    if (!fs.existsSync(targetFile)) {
      const sampleConfig = {
        Dhcp4: {
          'interfaces-config': {
            interfaces: ['*']
          },
          'control-socket': {
            'socket-type': 'unix',
            'socket-name': '/run/kea/kea4-ctrl-socket'
          },
          'lease-database': {
            type: 'memfile',
            persist: true,
            name: '/var/lib/kea/kea-leases4.csv'
          },
          'valid-lifetime': 4000,
          'renew-timer': 1000,
          'rebind-timer': 2000,
          subnet4: [
            {
              id: 1,
              subnet: '192.168.100.0/24',
              pools: [
                {
                  pool: '192.168.100.10 - 192.168.100.200'
                }
              ],
              'option-data': [
                {
                  name: 'routers',
                  data: '192.168.100.1'
                },
                {
                  name: 'domain-name-servers',
                  data: '8.8.8.8, 1.1.1.1'
                },
                {
                  name: 'domain-name',
                  data: 'local.lan'
                }
              ],
              reservations: [
                {
                  'hw-address': '00:11:22:33:44:55',
                  'ip-address': '192.168.100.25',
                  hostname: 'test-host'
                }
              ]
            }
          ]
        }
      };

      try {
        const dir = path.dirname(targetFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(targetFile, JSON.stringify(sampleConfig, null, 2), 'utf8');
      } catch (e) {
        // Ignored if cannot write
      }
    }
  }

  /**
   * Initialize dynamic realistic mock leases
   */
  private initMockLeases(): void {
    const nowSec = Math.floor(Date.now() / 1000);

    this.mockLeases = [
      {
        'ip-address': '192.168.100.15',
        'hw-address': '00:1a:2b:3c:4d:5e',
        'valid-lft': 4000,
        cltt: nowSec - 600, // Allocated 10 min ago
        hostname: 'macbook-pro',
        state: 0,
        'subnet-id': 1
      },
      {
        'ip-address': '192.168.100.20',
        'hw-address': 'a4:83:e7:12:34:56',
        'valid-lft': 4000,
        cltt: nowSec - 1200, // Allocated 20 min ago
        hostname: 'ubuntu-devbox',
        state: 0,
        'subnet-id': 1
      },
      {
        // Reserved static match (matching 00:11:22:33:44:55 reservation)
        'ip-address': '192.168.100.25',
        'hw-address': '00:11:22:33:44:55',
        'valid-lft': 4000,
        cltt: nowSec - 300,
        hostname: 'test-host',
        state: 0,
        'subnet-id': 1
      },
      {
        'ip-address': '192.168.100.42',
        'hw-address': '3c:22:fb:99:88:77',
        'valid-lft': 4000,
        cltt: nowSec - 1800,
        hostname: 'printer-office',
        state: 0,
        'subnet-id': 1
      },
      {
        'ip-address': '192.168.100.55',
        'hw-address': 'e0:d5:5e:66:77:88',
        'valid-lft': 4000,
        cltt: nowSec - 90,
        hostname: 'ipad-reception',
        state: 0,
        'subnet-id': 1
      },
      {
        // Expired lease (cltt + valid-lft is in the past)
        'ip-address': '192.168.100.88',
        'hw-address': '8c:fe:74:11:22:33',
        'valid-lft': 3600,
        cltt: nowSec - 7200, // expired 1 hr ago
        hostname: 'guest-phone',
        state: 2,
        'subnet-id': 1
      }
    ];
  }

  /**
   * Return simulated Service Status
   */
  getServiceStatus(): DhcpServiceStatus {
    const overallActive = this.dhcp4Active && this.ctrlAgentActive;
    const sinceDate = new Date(this.startTime).toUTCString();

    const dhcp4Daemon: ServiceDaemonStatus = {
      service: config.dhcpService,
      active: this.dhcp4Active,
      status: this.dhcp4Active ? 'active (running)' : 'inactive (stopped)',
      pid: this.dhcp4Active ? this.dhcp4Pid : null,
      since: this.dhcp4Active ? sinceDate : null,
      raw: `● ${config.dhcpService}.service - Kea DHCPv4 Server [MOCKUP MODE]\n   Active: ${this.dhcp4Active ? 'active (running)' : 'inactive (stopped)'} since ${sinceDate}; Main PID: ${this.dhcp4Pid}`
    };

    const ctrlAgentDaemon: ServiceDaemonStatus = {
      service: config.ctrlAgentService,
      active: this.ctrlAgentActive,
      status: this.ctrlAgentActive ? 'active (running)' : 'inactive (stopped)',
      pid: this.ctrlAgentActive ? this.ctrlAgentPid : null,
      since: this.ctrlAgentActive ? sinceDate : null,
      raw: `● ${config.ctrlAgentService}.service - Kea Control Agent [MOCKUP MODE]\n   Active: ${this.ctrlAgentActive ? 'active (running)' : 'inactive (stopped)'} since ${sinceDate}; Main PID: ${this.ctrlAgentPid}`
    };

    return {
      service: `${config.dhcpService} & ${config.ctrlAgentService}`,
      active: overallActive,
      status: overallActive
        ? 'active (running)'
        : this.dhcp4Active
        ? 'degraded (ctrl-agent inactive)'
        : 'inactive (stopped)',
      pid: this.dhcp4Pid,
      since: sinceDate,
      dhcp4: dhcp4Daemon,
      ctrlAgent: ctrlAgentDaemon
    };
  }

  /**
   * Handle interactive service lifecycle actions (start, stop, restart, reload)
   */
  controlService(action: ServiceAction, target = 'all'): { success: boolean; message: string } {
    const results: string[] = [];

    if (action === 'stop') {
      if (target === 'all' || target === 'dhcp4' || target === 'dhcp') {
        this.dhcp4Active = false;
        results.push(`${config.dhcpService}: stopped [mock]`);
      }
      if (target === 'all' || target === 'ctrl-agent' || target === 'agent') {
        this.ctrlAgentActive = false;
        results.push(`${config.ctrlAgentService}: stopped [mock]`);
      }
    } else if (action === 'start') {
      if (target === 'all' || target === 'dhcp4' || target === 'dhcp') {
        this.dhcp4Active = true;
        this.dhcp4Pid = Math.floor(10000 + Math.random() * 20000);
        results.push(`${config.dhcpService}: started [mock]`);
      }
      if (target === 'all' || target === 'ctrl-agent' || target === 'agent') {
        this.ctrlAgentActive = true;
        this.ctrlAgentPid = Math.floor(10000 + Math.random() * 20000);
        results.push(`${config.ctrlAgentService}: started [mock]`);
      }
    } else if (action === 'restart' || action === 'reload') {
      this.dhcp4Active = true;
      this.ctrlAgentActive = true;
      this.dhcp4Pid = Math.floor(10000 + Math.random() * 20000);
      this.ctrlAgentPid = Math.floor(10000 + Math.random() * 20000);
      this.startTime = Date.now();
      results.push(`${config.dhcpService} & ${config.ctrlAgentService}: ${action} OK [mock]`);
    }

    return {
      success: true,
      message: results.join(', ')
    };
  }

  /**
   * Get dynamic mock logs with realistic timestamps
   */
  getLogs(service = 'all', limit = 100): ServiceLogEntry[] {
    const safeLimit = Math.min(Math.max(limit, 1), 500);
    const now = Date.now();
    const mockTemplates: Array<{ offsetSec: number; svc: string; level: LogLevel; event: string; message: string }> = [
      { offsetSec: 20, svc: 'kea-ctrl-agent', level: 'INFO', event: 'COMMAND_RECEIVED', message: "Received command 'lease4-get-all' via REST HTTP interface" },
      { offsetSec: 45, svc: 'kea-dhcp4', level: 'INFO', event: 'DHCP4_PACKET_RECEIVED', message: "DHCPREQUEST for 192.168.100.15 from 00:1a:2b:3c:4d:5e on eth0" },
      { offsetSec: 46, svc: 'kea-dhcp4', level: 'INFO', event: 'DHCP4_LEASE_ALLOC', message: "Lease allocated for 192.168.100.15 (mac: 00:1a:2b:3c:4d:5e, hostname: macbook-pro, valid-lft: 4000s)" },
      { offsetSec: 46, svc: 'kea-dhcp4', level: 'INFO', event: 'DHCP4_PACKET_SEND', message: "DHCPOFFER packet sent to 192.168.100.15 over eth0" },
      { offsetSec: 90, svc: 'kea-dhcp4', level: 'INFO', event: 'HA_HEARTBEAT', message: "High Availability heartbeat sent to partner node (state: ready)" },
      { offsetSec: 150, svc: 'kea-ctrl-agent', level: 'INFO', event: 'COMMAND_RECEIVED', message: "Received command 'config-get' for dhcp4" },
      { offsetSec: 210, svc: 'kea-dhcp4', level: 'WARN', event: 'DHCP4_RESERVE_NOTICE', message: "Reservation check: static mapping found for 00:11:22:33:44:55 -> 192.168.100.25 (test-host)" },
      { offsetSec: 320, svc: 'kea-dhcp4', level: 'INFO', event: 'DHCP4_PACKET_RECEIVED', message: "DHCPDISCOVER from e0:d5:5e:66:77:88 on interface eth0" },
      { offsetSec: 321, svc: 'kea-dhcp4', level: 'INFO', event: 'DHCP4_LEASE_ALLOC', message: "Lease allocated for 192.168.100.55 (ipad-reception, valid-lft: 4000s)" },
      { offsetSec: 600, svc: 'kea-dhcp4', level: 'DEBUG', event: 'ALLOC_ENGINE', message: "Pool 192.168.100.10-192.168.100.200 has 185 available addresses remaining" },
      { offsetSec: 1200, svc: 'kea-dhcp4', level: 'INFO', event: 'CONFIG_LOAD_SUCCESS', message: "Configuration file parsed and reloaded successfully: /etc/kea/kea-dhcp4.conf" },
      { offsetSec: 1800, svc: 'kea-ctrl-agent', level: 'INFO', event: 'AGENT_STARTED', message: "Kea Control Agent v2.4.1 listening on 127.0.0.1:8000" }
    ];

    const result: ServiceLogEntry[] = [];
    let idCounter = 1;

    for (const t of mockTemplates) {
      if (service !== 'all' && !t.svc.includes(service)) {
        continue;
      }
      const itemTime = new Date(now - t.offsetSec * 1000).toISOString().slice(0, 19).replace('T', ' ');
      result.push({
        id: `mock-log-${idCounter++}`,
        timestamp: itemTime,
        service: t.svc,
        level: t.level,
        event: t.event,
        message: t.message,
        raw: `${itemTime}.123 ${t.level.padEnd(5)} [${t.svc}.commands] ${t.event} ${t.message}`
      });
      if (result.length >= safeLimit) break;
    }

    return result;
  }

  /**
   * Return mock leases
   */
  getAllLeases(): KeaRawLease[] {
    return [...this.mockLeases];
  }

  /**
   * Release lease by IP in mock mode
   */
  releaseLease(ipAddress: string): { success: boolean; message: string } {
    const beforeCount = this.mockLeases.length;
    this.mockLeases = this.mockLeases.filter((l) => l['ip-address'] !== ipAddress && l.ip !== ipAddress);
    return {
      success: true,
      message: `[MOCK] Lease for ${ipAddress} released (${beforeCount - this.mockLeases.length} removed)`
    };
  }

  /**
   * Handle Kea Control Agent commands simulated in-memory
   */
  async handleCommand<T = Record<string, unknown>>(
    command: string,
    _service: string | string[],
    args: Record<string, unknown> = {}
  ): Promise<T> {
    if (command === 'status-get') {
      return {
        result: 0,
        text: 'Kea DHCPv4 Server running (Mock Mode)',
        pid: this.dhcp4Pid,
        uptime: Math.floor((Date.now() - this.startTime) / 1000)
      } as unknown as T;
    }

    if (command === 'version-get') {
      return {
        version: '2.4.1',
        extended: 'Kea DHCP 2.4.1 [Mockup Mode Simulation]'
      } as unknown as T;
    }

    if (command === 'lease4-get-all') {
      return {
        leases: this.mockLeases
      } as unknown as T;
    }

    if (command === 'lease4-del') {
      const ip = (args['ip-address'] as string) || '';
      this.releaseLease(ip);
      return {
        result: 0,
        text: `Lease for ${ip} deleted`
      } as unknown as T;
    }

    if (command === 'config-get') {
      // Read directly from config file in dataDir
      if (fs.existsSync(config.confPath)) {
        try {
          const raw = fs.readFileSync(config.confPath, 'utf8');
          const json = JSON.parse(raw);
          return { Dhcp4: json.Dhcp4 || json } as unknown as T;
        } catch {
          // fallback
        }
      }
      return { Dhcp4: {} } as unknown as T;
    }

    if (command === 'config-set') {
      const dhcp4 = (args.Dhcp4 as KeaDhcp4Config) || {};
      const fullJson = { Dhcp4: dhcp4 };
      try {
        fs.writeFileSync(config.confPath, JSON.stringify(fullJson, null, 2), 'utf8');
      } catch (e) {
        // ignore
      }
      return {
        result: 0,
        text: 'Configuration applied (Mock Mode)'
      } as unknown as T;
    }

    if (command === 'config-write') {
      return {
        result: 0,
        text: 'Configuration saved (Mock Mode)'
      } as unknown as T;
    }

    if (command === 'ha-heartbeat') {
      return {
        result: 0,
        text: 'HA Heartbeat ACK (Mock Mode)'
      } as unknown as T;
    }

    return {
      result: 0,
      text: `Command '${command}' handled by mock data engine`
    } as unknown as T;
  }
}

export default new MockDataService();
