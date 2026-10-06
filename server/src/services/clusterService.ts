import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import config from '../config/default';
import { DATA_DIR } from '../config/paths';
import keaService from './keaService';
import {
  ClusterNode,
  ClusterSettings,
  ClusterOverview,
  SyncLogEntry
} from '../../../shared/types/cluster';
import { KeaDhcp4Config } from '../types/kea';

const clusterFile = path.join(DATA_DIR, 'cluster.json');
const syncLogsFile = path.join(DATA_DIR, 'cluster-sync-logs.json');

export interface StoredClusterData {
  settings: ClusterSettings;
  nodes: ClusterNode[];
}

export class ClusterService {
  private data: StoredClusterData;
  private syncLogs: SyncLogEntry[] = [];

  constructor() {
    this.data = this.loadClusterData();
    this.loadSyncLogs();
  }

  /**
   * Determine default location for libdhcp_ha.so based on OS
   */
  getDefaultHaHookLibPath(): string {
    const candidates = [
      '/usr/lib/x86_64-linux-gnu/kea/hooks/libdhcp_ha.so',
      '/usr/lib/aarch64-linux-gnu/kea/hooks/libdhcp_ha.so',
      '/usr/lib64/kea/hooks/libdhcp_ha.so',
      '/usr/lib/kea/hooks/libdhcp_ha.so'
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return c;
      }
    }

    return config.isRhelBased
      ? '/usr/lib64/kea/hooks/libdhcp_ha.so'
      : '/usr/lib/x86_64-linux-gnu/kea/hooks/libdhcp_ha.so';
  }

  private loadClusterData(): StoredClusterData {
    if (fs.existsSync(clusterFile)) {
      try {
        const raw = fs.readFileSync(clusterFile, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.settings && Array.isArray(parsed.nodes)) {
          return parsed;
        }
      } catch (e) {
        console.error('[ClusterService] Failed to parse cluster.json, creating default');
      }
    }

    // Default cluster configuration
    const initialSecret = crypto.randomBytes(16).toString('hex');
    const defaultData: StoredClusterData = {
      settings: {
        enabled: false,
        mode: 'failover',
        thisServerName: 'node-primary',
        clusterSecret: initialSecret,
        autoSyncOnSave: true,
        periodicSyncIntervalSec: 60,
        heartbeatDelayMs: 10000,
        maxResponseDelayMs: 60000,
        maxAckDelayMs: 5000,
        autoFailover: true,
        haHookLibPath: this.getDefaultHaHookLibPath()
      },
      nodes: [
        {
          id: 'local-node',
          name: 'Primary Node (Local)',
          host: '127.0.0.1',
          uiPort: config.port,
          agentUrl: config.keaCtrlAgentUrl,
          role: 'primary',
          isLocal: true,
          status: 'online',
          syncStatus: 'synced',
          lastHeartbeat: new Date().toISOString()
        }
      ]
    };

    this.saveClusterData(defaultData);
    return defaultData;
  }

  private saveClusterData(data: StoredClusterData): void {
    this.data = data;
    try {
      fs.writeFileSync(clusterFile, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
    } catch (e) {
      console.error('[ClusterService] Failed to write cluster.json:', e);
    }
  }

  private loadSyncLogs(): void {
    if (fs.existsSync(syncLogsFile)) {
      try {
        const raw = fs.readFileSync(syncLogsFile, 'utf8');
        this.syncLogs = JSON.parse(raw);
      } catch {
        this.syncLogs = [];
      }
    }
  }

  addSyncLog(entry: Omit<SyncLogEntry, 'id' | 'timestamp'>): void {
    const logItem: SyncLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.syncLogs.unshift(logItem);
    if (this.syncLogs.length > 50) {
      this.syncLogs = this.syncLogs.slice(0, 50);
    }
    try {
      fs.writeFileSync(syncLogsFile, JSON.stringify(this.syncLogs, null, 2), 'utf8');
    } catch (e) {
      // ignore
    }
  }

  getSyncLogs(): SyncLogEntry[] {
    return this.syncLogs;
  }

  getSettings(): ClusterSettings {
    return { ...this.data.settings };
  }

  getNodes(): ClusterNode[] {
    return [...this.data.nodes];
  }

  getNodeById(id: string): ClusterNode | undefined {
    return this.data.nodes.find((n) => n.id === id);
  }

  getLocalNode(): ClusterNode | undefined {
    return this.data.nodes.find((n) => n.isLocal);
  }

  updateNodeStatus(
    id: string,
    updates: Partial<Pick<ClusterNode, 'status' | 'latencyMs' | 'lastHeartbeat' | 'haState' | 'syncStatus' | 'lastSyncTime' | 'errorMessage'>>
  ): void {
    const node = this.data.nodes.find((n) => n.id === id);
    if (node) {
      Object.assign(node, updates);
      this.saveClusterData(this.data);
    }
  }

  async updateSettings(newSettings: Partial<ClusterSettings>): Promise<ClusterSettings> {
    const merged = { ...this.data.settings, ...newSettings };
    this.data.settings = merged;
    this.saveClusterData(this.data);

    // Apply or remove Kea HA hook in configuration
    await this.applyKeaHaConfig();
    return merged;
  }

  async addNode(nodeData: Omit<ClusterNode, 'id'>): Promise<ClusterNode> {
    const id = `node-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newNode: ClusterNode = {
      ...nodeData,
      id,
      agentUrl: nodeData.agentUrl || `http://${nodeData.host}:8000`,
      status: 'offline',
      syncStatus: 'pending'
    };

    if (newNode.isLocal) {
      // Ensure only one node is marked local
      this.data.nodes.forEach((n) => (n.isLocal = false));
    }

    this.data.nodes.push(newNode);
    this.saveClusterData(this.data);

    // Reapply Kea HA hook configuration with new peers
    if (this.data.settings.enabled) {
      await this.applyKeaHaConfig();
    }

    return newNode;
  }

  async updateNode(id: string, updates: Partial<ClusterNode>): Promise<ClusterNode> {
    const index = this.data.nodes.findIndex((n) => n.id === id);
    if (index === -1) {
      throw new Error(`Node with id '${id}' not found`);
    }

    if (updates.isLocal) {
      this.data.nodes.forEach((n) => (n.isLocal = false));
    }

    const updated = { ...this.data.nodes[index], ...updates };
    this.data.nodes[index] = updated;
    this.saveClusterData(this.data);

    if (this.data.settings.enabled) {
      await this.applyKeaHaConfig();
    }

    return updated;
  }

  async deleteNode(id: string): Promise<void> {
    const node = this.data.nodes.find((n) => n.id === id);
    if (!node) {
      throw new Error(`Node with id '${id}' not found`);
    }
    if (node.isLocal) {
      throw new Error(`Cannot delete local node`);
    }

    this.data.nodes = this.data.nodes.filter((n) => n.id !== id);
    this.saveClusterData(this.data);

    if (this.data.settings.enabled) {
      await this.applyKeaHaConfig();
    }
  }

  /**
   * Inject or update libdhcp_ha.so hook in Kea configuration
   */
  async applyKeaHaConfig(): Promise<void> {
    try {
      const rawKea = await keaService.getConfig();
      const current = JSON.parse(JSON.stringify(rawKea)) as KeaDhcp4Config;

      const hookLibPath = this.data.settings.haHookLibPath || this.getDefaultHaHookLibPath();
      let hooks = Array.isArray(current['hooks-libraries'])
        ? [...(current['hooks-libraries'] as Array<{ library: string; parameters?: Record<string, unknown> }>)]
        : [];

      // Filter out existing HA hook if any
      hooks = hooks.filter((h) => !h.library.includes('libdhcp_ha.so'));

      if (this.data.settings.enabled && this.data.nodes.length >= 2) {
        // Construct HA Hook parameters
        const mode = this.data.settings.mode === 'load-balancing' ? 'load-balancing' : 'hot-standby';
        const peers = this.data.nodes.map((n) => ({
          name: n.name.replace(/[^a-zA-Z0-9_-]/g, '_'),
          url: n.agentUrl || `http://${n.host}:8000/`,
          role: n.role === 'primary' ? 'primary' : 'secondary',
          'auto-failover': this.data.settings.autoFailover
        }));

        const localNode = this.getLocalNode() || this.data.nodes[0];
        const thisServerName = localNode.name.replace(/[^a-zA-Z0-9_-]/g, '_');

        hooks.push({
          library: hookLibPath,
          parameters: {
            'high-availability': [
              {
                'this-server-name': thisServerName,
                mode: mode,
                'heartbeat-delay': this.data.settings.heartbeatDelayMs,
                'max-response-delay': this.data.settings.maxResponseDelayMs,
                'max-ack-delay': this.data.settings.maxAckDelayMs,
                'max-unacked-clients': 0,
                'sync-page-limit': 10000,
                peers: peers
              }
            ]
          }
        });
      }

      current['hooks-libraries'] = hooks;
      await keaService.setConfig(current, 'Cluster High Availability updated via Web UI');
    } catch (err) {
      console.error('[ClusterService] Failed to apply Kea HA configuration:', err);
    }
  }

  /**
   * Query Kea HA status using Kea Control Agent command status-get
   */
  async getKeaHaStatus(): Promise<Record<string, unknown> | null> {
    try {
      const res = await keaService.sendCommand<Record<string, unknown>>('status-get', ['dhcp4']);
      return res;
    } catch (e) {
      return null;
    }
  }


  /**
   * Trigger Kea HA lease sync from partner
   */
  async triggerKeaHaSync(): Promise<{ success: boolean; message: string }> {
    try {
      await keaService.sendCommand('ha-sync', ['dhcp4'], { max_pages: 10 });
      return { success: true, message: 'Kea HA sync command initiated successfully' };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, message: `Kea HA sync failed: ${msg}` };
    }
  }

  /**
   * Get overall cluster status summary
   */
  getOverview(): ClusterOverview {
    const totalNodes = this.data.nodes.length;
    const onlineNodes = this.data.nodes.filter((n) => n.status === 'online').length;
    const syncedNodes = this.data.nodes.filter((n) => n.syncStatus === 'synced').length;

    let clusterHealth: ClusterOverview['summary']['clusterHealth'] = 'healthy';
    if (!this.data.settings.enabled) {
      clusterHealth = 'disabled';
    } else if (onlineNodes === 0) {
      clusterHealth = 'offline';
    } else if (syncedNodes < totalNodes) {
      clusterHealth = 'out_of_sync';
    } else if (onlineNodes < totalNodes) {
      clusterHealth = 'degraded';
    }

    const lastSyncTime = this.syncLogs.length > 0 ? this.syncLogs[0].timestamp : undefined;

    return {
      settings: this.getSettings(),
      nodes: this.getNodes(),
      summary: {
        totalNodes,
        onlineNodes,
        syncedNodes,
        clusterHealth,
        lastSyncTime
      }
    };
  }
}

export default new ClusterService();
