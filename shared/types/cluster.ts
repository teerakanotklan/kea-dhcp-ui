import { z } from 'zod';

export const ClusterModeSchema = z.enum(['standalone', 'failover', 'load-balancing']);
export type ClusterMode = z.infer<typeof ClusterModeSchema>;

export const NodeRoleSchema = z.enum(['primary', 'secondary', 'backup']);
export type NodeRole = z.infer<typeof NodeRoleSchema>;

export const NodeStatusSchema = z.enum(['online', 'offline', 'unreachable', 'syncing', 'error']);
export type NodeStatus = z.infer<typeof NodeStatusSchema>;

export const SyncStatusSchema = z.enum(['synced', 'pending', 'syncing', 'drift_detected', 'failed', 'disabled']);
export type SyncStatus = z.infer<typeof SyncStatusSchema>;

export const ClusterNodeSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Host name is required'),
  host: z.string().min(1, 'Host IP or FQDN is required'),
  uiPort: z.number().int().min(1).max(65535).default(3000),
  agentUrl: z.string().optional(),
  role: NodeRoleSchema.default('secondary'),
  isLocal: z.boolean().default(false),
  status: NodeStatusSchema.default('offline'),
  latencyMs: z.number().optional(),
  lastHeartbeat: z.string().optional(),
  haState: z.string().optional(), // Kea HA hook state (ready, partner-down, syncing, etc.)
  syncStatus: SyncStatusSchema.default('pending'),
  lastSyncTime: z.string().optional(),
  errorMessage: z.string().optional()
});
export type ClusterNode = z.infer<typeof ClusterNodeSchema>;

export const ClusterSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  mode: ClusterModeSchema.default('failover'),
  thisServerName: z.string().default('node-primary'),
  clusterSecret: z.string().min(8, 'Cluster secret must be at least 8 characters'),
  autoSyncOnSave: z.boolean().default(true),
  periodicSyncIntervalSec: z.number().int().min(0).default(60), // 0 to disable
  heartbeatDelayMs: z.number().int().min(1000).default(10000),
  maxResponseDelayMs: z.number().int().min(1000).default(60000),
  maxAckDelayMs: z.number().int().min(500).default(5000),
  autoFailover: z.boolean().default(true),
  haHookLibPath: z.string().optional()
});
export type ClusterSettings = z.infer<typeof ClusterSettingsSchema>;

export interface ClusterSyncPayload {
  version: number;
  sourceNodeId: string;
  sourceNodeName: string;
  timestamp: string;
  checksum: string;
  config: {
    rawConfig?: string;
    subnets?: unknown[];
    global?: unknown;
    hosts?: unknown[];
  };
}

export interface ClusterDiffItem {
  type: 'subnet' | 'host' | 'global';
  key: string;
  localValue: string;
  remoteValue: string;
  difference: 'missing_in_remote' | 'missing_in_local' | 'modified';
}

export interface ClusterDiffResult {
  inSync: boolean;
  localChecksum: string;
  remoteChecksum: string;
  differences: ClusterDiffItem[];
  checkedAt: string;
}

export interface ClusterOverview {
  settings: ClusterSettings;
  nodes: ClusterNode[];
  summary: {
    totalNodes: number;
    onlineNodes: number;
    syncedNodes: number;
    clusterHealth: 'healthy' | 'degraded' | 'out_of_sync' | 'offline' | 'disabled';
    lastSyncTime?: string;
  };
}

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  action: 'push' | 'pull' | 'auto_sync' | 'drift_sync';
  targetNodeId: string;
  targetNodeName: string;
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}
