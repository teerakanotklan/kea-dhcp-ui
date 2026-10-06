import crypto from 'crypto';
import clusterService from './clusterService';
import dhcpConfigService from './dhcpConfigService';
import keaService from './keaService';
import backupService from './backupService';
import config from '../config/default';
import {
  ClusterNode,
  ClusterSyncPayload,
  ClusterDiffResult,
  ClusterDiffItem
} from '../../../shared/types/cluster';
import { KeaDhcp4Config } from '../types/kea';

export class ClusterSyncService {
  private timer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;

  constructor() {
    // will be started from server index
  }

  /**
   * Compute a deterministic SHA-256 hash of the Kea DHCP4 configuration
   */
  computeChecksum(dhcp4: KeaDhcp4Config): string {
    // Clean out volatile/node-specific fields like hooks-libraries for hash comparison
    const comparable = {
      subnet4: dhcp4.subnet4 || [],
      'option-data': dhcp4['option-data'] || [],
      'valid-lifetime': dhcp4['valid-lifetime'],
      'renew-timer': dhcp4['renew-timer'],
      'rebind-timer': dhcp4['rebind-timer'],
      authoritative: dhcp4.authoritative
    };
    const serialized = JSON.stringify(comparable, Object.keys(comparable).sort());
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Export the local Kea configuration into a standardized sync payload
   */
  async exportSyncPayload(): Promise<ClusterSyncPayload> {
    const localNode = clusterService.getLocalNode() || {
      id: 'local-node',
      name: 'Primary Node'
    };
    const rawDhcp4 = await keaService.getConfig();
    const checksum = this.computeChecksum(rawDhcp4);
    const parsed = await dhcpConfigService.parseConfig();

    return {
      version: 1,
      sourceNodeId: localNode.id,
      sourceNodeName: localNode.name,
      timestamp: new Date().toISOString(),
      checksum,
      config: {
        rawConfig: JSON.stringify({ Dhcp4: rawDhcp4 }, null, 2),
        subnets: parsed.subnets,
        hosts: parsed.hosts,
        global: parsed.global
      }
    };
  }

  /**
   * Test connection to a remote cluster node (both Web UI API and Kea Control Agent)
   */
  async testNodeConnection(node: ClusterNode): Promise<{
    success: boolean;
    latencyMs: number;
    uiReachable: boolean;
    agentReachable: boolean;
    message: string;
    remoteChecksum?: string;
    haState?: string;
  }> {
    const startTime = Date.now();
    let uiReachable = false;
    let agentReachable = false;
    let remoteChecksum: string | undefined;
    let haState: string | undefined;

    // 1. Test Web UI Endpoint (/api/health)
    const uiUrl = `http://${node.host}:${node.uiPort}/api/health`;
    try {
      const res = await fetch(uiUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        uiReachable = true;
      }
    } catch {
      uiReachable = false;
    }

    // 2. Fetch remote cluster pull status if UI is reachable
    if (uiReachable) {
      try {
        const pullUrl = `http://${node.host}:${node.uiPort}/api/cluster/sync/pull`;
        const res = await fetch(pullUrl, {
          method: 'GET',
          headers: {
            'X-Cluster-Secret': clusterService.getSettings().clusterSecret
          },
          signal: AbortSignal.timeout(4000)
        });
        if (res.ok) {
          const data = (await res.json()) as { checksum?: string; haState?: string };
          remoteChecksum = data.checksum;
          haState = data.haState;
        }
      } catch {
        // pull optional
      }
    }

    // 3. Test Kea Control Agent endpoint
    const agentUrl = node.agentUrl || `http://${node.host}:8000/`;
    try {
      const res = await fetch(agentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'status-get', service: ['dhcp4'] }),
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        agentReachable = true;
      }
    } catch {
      agentReachable = false;
    }

    const latencyMs = Date.now() - startTime;
    const success = uiReachable || agentReachable;

    let message = 'Connection successful';
    if (!uiReachable && !agentReachable) {
      message = 'Host unreachable (both Web UI and Kea Control Agent timed out)';
    } else if (!uiReachable) {
      message = 'Web UI unreachable on port ' + node.uiPort + ' (Kea Agent is online)';
    } else if (!agentReachable) {
      message = 'Web UI reachable, but Kea Control Agent is unreachable on port 8000';
    }

    // Update node status in store
    clusterService.updateNodeStatus(node.id, {
      status: success ? 'online' : 'offline',
      latencyMs: success ? latencyMs : undefined,
      lastHeartbeat: new Date().toISOString(),
      haState: haState || (agentReachable ? 'connected' : undefined),
      errorMessage: success ? undefined : message
    });

    return {
      success,
      latencyMs,
      uiReachable,
      agentReachable,
      message,
      remoteChecksum,
      haState
    };
  }

  /**
   * Push current configuration to a specific remote node
   */
  async syncToNode(node: ClusterNode, action: 'push' | 'auto_sync' = 'push'): Promise<{ success: boolean; message: string }> {
    if (node.isLocal) {
      return { success: true, message: 'Local node does not need synchronization' };
    }

    clusterService.updateNodeStatus(node.id, { syncStatus: 'syncing' });

    try {
      const payload = await this.exportSyncPayload();
      const settings = clusterService.getSettings();
      const targetUrl = `http://${node.host}:${node.uiPort}/api/cluster/sync/receive`;

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Cluster-Secret': settings.clusterSecret
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000)
      });

      const data = (await res.json()) as { success?: boolean; error?: string; message?: string };

      if (!res.ok || data.success === false) {
        const errorMsg = data.error || data.message || `Remote server responded with HTTP ${res.status}`;
        clusterService.updateNodeStatus(node.id, {
          syncStatus: 'failed',
          errorMessage: errorMsg
        });
        clusterService.addSyncLog({
          action,
          targetNodeId: node.id,
          targetNodeName: node.name,
          success: false,
          message: errorMsg
        });
        return { success: false, message: errorMsg };
      }

      const successMsg = data.message || 'Configuration synchronized successfully';
      const now = new Date().toISOString();

      clusterService.updateNodeStatus(node.id, {
        syncStatus: 'synced',
        lastSyncTime: now,
        errorMessage: undefined
      });

      clusterService.addSyncLog({
        action,
        targetNodeId: node.id,
        targetNodeName: node.name,
        success: true,
        message: successMsg,
        details: { checksum: payload.checksum }
      });

      return { success: true, message: successMsg };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      clusterService.updateNodeStatus(node.id, {
        syncStatus: 'failed',
        errorMessage: errorMsg
      });
      clusterService.addSyncLog({
        action,
        targetNodeId: node.id,
        targetNodeName: node.name,
        success: false,
        message: errorMsg
      });
      return { success: false, message: errorMsg };
    }
  }

  /**
   * Broadcast configuration to all non-local nodes
   */
  async broadcastSync(action: 'push' | 'auto_sync' = 'push'): Promise<{
    total: number;
    successful: number;
    failed: number;
    results: Array<{ nodeId: string; name: string; success: boolean; message: string }>;
  }> {
    if (this.isSyncing) {
      return { total: 0, successful: 0, failed: 0, results: [] };
    }

    this.isSyncing = true;
    const nodes = clusterService.getNodes().filter((n) => !n.isLocal);
    const results: Array<{ nodeId: string; name: string; success: boolean; message: string }> = [];

    let successful = 0;
    let failed = 0;

    for (const node of nodes) {
      const res = await this.syncToNode(node, action);
      if (res.success) {
        successful++;
      } else {
        failed++;
      }
      results.push({
        nodeId: node.id,
        name: node.name,
        success: res.success,
        message: res.message
      });
    }

    this.isSyncing = false;
    return {
      total: nodes.length,
      successful,
      failed,
      results
    };
  }

  /**
   * Secure handler for receiving sync payload from remote peer node
   */
  async receiveSyncPayload(
    payload: ClusterSyncPayload,
    secretHeader?: string
  ): Promise<{ success: boolean; message: string }> {
    const settings = clusterService.getSettings();

    // 1. Authenticate using Shared Secret
    if (!secretHeader || secretHeader !== settings.clusterSecret) {
      throw new Error('Unauthorized: Invalid or missing Cluster Secret');
    }

    // 2. Validate payload format
    if (!payload || !payload.config || !payload.config.rawConfig) {
      throw new Error('Malformed sync payload: Missing raw configuration');
    }

    // 3. Syntax validation
    const syntax = dhcpConfigService.validateSyntax(payload.config.rawConfig);
    if (!syntax.valid) {
      throw new Error(`Syntax validation failed on received config: ${syntax.error}`);
    }

    // 4. Create local backup before applying
    try {
      backupService.createBackup(
        config.confPath,
        `Auto-backup before Cluster sync from ${payload.sourceNodeName} (${payload.sourceNodeId})`
      );
    } catch {
      // backup failure shouldn't stop sync
    }

    // 5. Parse configuration
    const parsedPayload = JSON.parse(payload.config.rawConfig);
    const dhcp4 = (parsedPayload.Dhcp4 || parsedPayload) as KeaDhcp4Config;

    // 6. Preserve and re-align local node's own HA Hook settings if cluster enabled
    if (settings.enabled) {
      const localNode = clusterService.getLocalNode();
      const thisServerName = localNode ? localNode.name.replace(/[^a-zA-Z0-9_-]/g, '_') : settings.thisServerName;
      const hookLibPath = settings.haHookLibPath || clusterService.getDefaultHaHookLibPath();

      let hooks = Array.isArray(dhcp4['hooks-libraries'])
        ? [...(dhcp4['hooks-libraries'] as Array<{ library: string; parameters?: Record<string, unknown> }>)]
        : [];

      hooks = hooks.filter((h) => !h.library.includes('libdhcp_ha.so'));

      const peers = clusterService.getNodes().map((n) => ({
        name: n.name.replace(/[^a-zA-Z0-9_-]/g, '_'),
        url: n.agentUrl || `http://${n.host}:8000/`,
        role: n.role === 'primary' ? 'primary' : 'secondary',
        'auto-failover': settings.autoFailover
      }));

      hooks.push({
        library: hookLibPath,
        parameters: {
          'high-availability': [
            {
              'this-server-name': thisServerName,
              mode: settings.mode === 'load-balancing' ? 'load-balancing' : 'hot-standby',
              'heartbeat-delay': settings.heartbeatDelayMs,
              'max-response-delay': settings.maxResponseDelayMs,
              'max-ack-delay': settings.maxAckDelayMs,
              'max-unacked-clients': 0,
              'sync-page-limit': 10000,
              peers: peers
            }
          ]
        }
      });

      dhcp4['hooks-libraries'] = hooks;
    }

    // 7. Persist and apply to Kea runtime (notifyListeners=false to prevent feedback loop)
    await keaService.setConfig(dhcp4, `Synced from cluster peer: ${payload.sourceNodeName}`, false);

    // 8. Record in Sync log
    clusterService.addSyncLog({
      action: 'pull',
      targetNodeId: payload.sourceNodeId,
      targetNodeName: payload.sourceNodeName,
      success: true,
      message: `Successfully received and applied configuration from ${payload.sourceNodeName}`,
      details: { checksum: payload.checksum }
    });

    return {
      success: true,
      message: `Successfully applied configuration from node ${payload.sourceNodeName}`
    };
  }

  /**
   * Compare local configuration against a remote node and return detailed differences
   */
  async getDiffWithNode(nodeId: string): Promise<ClusterDiffResult> {
    const node = clusterService.getNodeById(nodeId);
    if (!node) {
      throw new Error(`Node '${nodeId}' not found`);
    }

    const localPayload = await this.exportSyncPayload();
    const settings = clusterService.getSettings();

    // Pull remote config
    const pullUrl = `http://${node.host}:${node.uiPort}/api/cluster/sync/pull`;
    const res = await fetch(pullUrl, {
      method: 'GET',
      headers: {
        'X-Cluster-Secret': settings.clusterSecret
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch config from remote node: HTTP ${res.status}`);
    }

    const remotePayload = (await res.json()) as ClusterSyncPayload;
    const differences: ClusterDiffItem[] = [];

    const localSubnets = (localPayload.config.subnets || []) as Array<{ subnet?: string; id?: number | string }>;
    const remoteSubnets = (remotePayload.config?.subnets || []) as Array<{ subnet?: string; id?: number | string }>;

    const localSubnetSet = new Map(localSubnets.map((s) => [s.subnet || String(s.id), JSON.stringify(s)]));
    const remoteSubnetSet = new Map(remoteSubnets.map((s) => [s.subnet || String(s.id), JSON.stringify(s)]));

    // Compare subnets
    for (const [key, val] of localSubnetSet.entries()) {
      if (!remoteSubnetSet.has(key)) {
        differences.push({
          type: 'subnet',
          key,
          localValue: val,
          remoteValue: 'None',
          difference: 'missing_in_remote'
        });
      } else if (remoteSubnetSet.get(key) !== val) {
        differences.push({
          type: 'subnet',
          key,
          localValue: val,
          remoteValue: remoteSubnetSet.get(key) || '',
          difference: 'modified'
        });
      }
    }

    for (const [key, val] of remoteSubnetSet.entries()) {
      if (!localSubnetSet.has(key)) {
        differences.push({
          type: 'subnet',
          key,
          localValue: 'None',
          remoteValue: val,
          difference: 'missing_in_local'
        });
      }
    }

    const inSync = localPayload.checksum === remotePayload.checksum && differences.length === 0;

    // Update node sync status
    clusterService.updateNodeStatus(node.id, {
      syncStatus: inSync ? 'synced' : 'drift_detected'
    });

    return {
      inSync,
      localChecksum: localPayload.checksum,
      remoteChecksum: remotePayload.checksum,
      differences,
      checkedAt: new Date().toISOString()
    };
  }

  /**
   * Debounced notification triggered by changes in Scopes, Static Hosts, or Settings
   */
  notifyConfigChanged(): void {
    const settings = clusterService.getSettings();
    if (!settings.enabled || !settings.autoSyncOnSave) {
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      try {
        console.log('[ClusterSync] Auto-syncing configuration changes to peer nodes...');
        await this.broadcastSync('auto_sync');
      } catch (err) {
        console.error('[ClusterSync] Auto-sync failed:', err);
      }
    }, 1500);
  }

  /**
   * Start periodic health and drift check loop
   */
  startBackgroundSyncLoop(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    const runCheck = async () => {
      const settings = clusterService.getSettings();
      if (!settings.enabled || settings.periodicSyncIntervalSec <= 0) {
        return;
      }

      const nodes = clusterService.getNodes().filter((n) => !n.isLocal);
      for (const node of nodes) {
        try {
          const test = await this.testNodeConnection(node);
          if (test.success && test.remoteChecksum) {
            const localPayload = await this.exportSyncPayload();
            if (localPayload.checksum !== test.remoteChecksum) {
              clusterService.updateNodeStatus(node.id, { syncStatus: 'drift_detected' });
              // Auto-sync on drift if enabled
              if (settings.autoSyncOnSave) {
                await this.syncToNode(node, 'auto_sync');
              }
            } else {
              clusterService.updateNodeStatus(node.id, { syncStatus: 'synced' });
            }
          }
        } catch {
          // ignore loop errors
        }
      }
    };

    // Run first check after 5 seconds, then periodic interval
    setTimeout(runCheck, 5000);
    const intervalMs = Math.max(15, clusterService.getSettings().periodicSyncIntervalSec) * 1000;
    this.timer = setInterval(runCheck, intervalMs);
  }

  stopBackgroundSyncLoop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}

export default new ClusterSyncService();
