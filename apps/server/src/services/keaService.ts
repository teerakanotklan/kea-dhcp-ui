import fs from 'fs';
import config from '../config/default';
import backupService from './backupService';
import { KeaDhcp4Config, KeaRawLease } from '@kea/shared';
import { keaClient, parseLeasesCsv } from '../integrations/kea';

export class KeaService {
  private confPath: string;
  private configChangeListeners: Array<() => void> = [];

  constructor() {
    this.confPath = config.confPath;
  }

  onConfigChange(callback: () => void): void {
    this.configChangeListeners.push(callback);
  }

  /**
   * Send JSON command to Kea Control Agent via KeaClient integration
   */
  async sendCommand<T = Record<string, unknown>>(
    command: string,
    service: string | string[] = ['dhcp4'],
    args: Record<string, unknown> = {}
  ): Promise<T> {
    return keaClient.execute<T>(command, service, args);
  }

  /**
   * Check if Kea Control Agent is alive
   */
  async isAgentAvailable(): Promise<boolean> {
    return keaClient.isAlive();
  }

  /**
   * Fetch running configuration for Dhcp4
   */
  async getConfig(): Promise<KeaDhcp4Config> {
    try {
      const res = await this.sendCommand<{ Dhcp4?: KeaDhcp4Config }>('config-get', ['dhcp4']);
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
          return (json.Dhcp4 || json) as KeaDhcp4Config;
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : String(e);
          throw new Error(`Failed to read Kea config file: ${errMsg}`);
        }
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new Error(`Kea Control Agent unreachable and config file not found: ${errMsg}`);
    }
  }

  /**
   * Apply modified Dhcp4 configuration to Kea runtime and persist to disk
   */
  async setConfig(
    dhcp4Config: KeaDhcp4Config,
    comment = 'Updated via Web UI',
    notifyListeners = true
  ): Promise<{ success: boolean; appliedViaAgent: boolean; message: string }> {
    // 1. Auto backup current configuration on disk
    if (fs.existsSync(this.confPath)) {
      try {
        backupService.createBackup(this.confPath, comment);
      } catch {
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
      } catch {
        // If config-write not supported or failed, write to file directly
        this.writeConfigFile(dhcp4Config);
      }
    } catch {
      // Fallback: write to file directly on disk
      this.writeConfigFile(dhcp4Config);
    }

    if (notifyListeners) {
      this.configChangeListeners.forEach((fn) => {
        try {
          fn();
        } catch (e) {
          console.error('[KeaService] Error in config change listener:', e);
        }
      });
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
  writeConfigFile(dhcp4Config: KeaDhcp4Config): void {
    const fullJson = { Dhcp4: dhcp4Config };
    fs.writeFileSync(this.confPath, JSON.stringify(fullJson, null, 2), 'utf8');
  }

  /**
   * Fetch all active leases from Kea
   */
  async getAllLeases(): Promise<KeaRawLease[]> {
    if (!config.isProduction) {
      return this.sendCommand<KeaRawLease[]>('lease4-get-all', ['dhcp4']);
    }
    try {
      const res = await this.sendCommand<{ leases?: KeaRawLease[] }>('lease4-get-all', ['dhcp4']);
      return res.leases || [];
    } catch {
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
  async releaseLease(ipAddress: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.sendCommand('lease4-del', ['dhcp4'], { 'ip-address': ipAddress });
      return { success: true, message: `Lease for ${ipAddress} released` };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to release lease: ${errMsg}`);
    }
  }

  /**
   * Fallback CSV parser for Kea Memfile leases
   */
  parseLeasesCsv(csvPath: string): KeaRawLease[] {
    return parseLeasesCsv(csvPath);
  }
}

export default new KeaService();
