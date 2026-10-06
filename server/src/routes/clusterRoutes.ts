import express, { Request, Response } from 'express';
import authMiddleware from '../middleware/auth';
import clusterService from '../services/clusterService';
import clusterSyncService from '../services/clusterSyncService';
import { ClusterNodeSchema, ClusterSettingsSchema } from '../../../shared/types/cluster';

const router = express.Router();

/**
 * GET /api/cluster/overview
 * Cluster health, summary metrics, and active nodes
 */
router.get('/overview', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const overview = clusterService.getOverview();
    const haStatus = await clusterService.getKeaHaStatus();
    return res.json({
      ...overview,
      haStatus
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: errMsg });
  }
});

/**
 * GET /api/cluster/nodes
 * List all cluster nodes
 */
router.get('/nodes', authMiddleware, (_req: Request, res: Response) => {
  try {
    const nodes = clusterService.getNodes();
    return res.json(nodes);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: errMsg });
  }
});

/**
 * POST /api/cluster/nodes
 * Add a new node to the cluster
 */
router.post('/nodes', authMiddleware, async (req: Request, res: Response) => {
  try {
    const parsed = ClusterNodeSchema.omit({ id: true }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || 'Invalid node data' });
    }

    const created = await clusterService.addNode(parsed.data);
    return res.status(201).json(created);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return res.status(400).json({ error: errMsg });
  }
});

/**
 * PUT /api/cluster/nodes/:id
 * Update node properties
 */
router.put('/nodes/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const updated = await clusterService.updateNode(req.params.id, req.body);
    return res.json(updated);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return res.status(400).json({ error: errMsg });
  }
});

/**
 * DELETE /api/cluster/nodes/:id
 * Remove a node from the cluster
 */
router.delete('/nodes/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await clusterService.deleteNode(req.params.id);
    return res.json({ success: true, message: 'Node deleted successfully' });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return res.status(400).json({ error: errMsg });
  }
});

/**
 * POST /api/cluster/nodes/:id/test
 * Test network connectivity, Web UI, and Kea Agent on the remote node
 */
router.post('/nodes/:id/test', authMiddleware, async (req: Request, res: Response) => {
  try {
    const node = clusterService.getNodeById(req.params.id);
    if (!node) {
      return res.status(404).json({ error: `Node '${req.params.id}' not found` });
    }

    const result = await clusterSyncService.testNodeConnection(node);
    return res.json(result);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: errMsg });
  }
});

/**
 * GET /api/cluster/settings
 * Retrieve cluster settings
 */
router.get('/settings', authMiddleware, (_req: Request, res: Response) => {
  try {
    const settings = clusterService.getSettings();
    return res.json(settings);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: errMsg });
  }
});

/**
 * PUT /api/cluster/settings
 * Update cluster settings and HA configuration
 */
router.put('/settings', authMiddleware, async (req: Request, res: Response) => {
  try {
    const parsed = ClusterSettingsSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || 'Invalid settings data' });
    }

    const updated = await clusterService.updateSettings(parsed.data);
    return res.json(updated);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return res.status(400).json({ error: errMsg });
  }
});

/**
 * POST /api/cluster/sync/push
 * Push configuration to all nodes or a specific node
 */
router.post('/sync/push', authMiddleware, async (req: Request, res: Response) => {
  const { nodeId } = req.body || {};
  try {
    if (nodeId) {
      const node = clusterService.getNodeById(nodeId);
      if (!node) {
        return res.status(404).json({ error: `Node '${nodeId}' not found` });
      }
      const result = await clusterSyncService.syncToNode(node, 'push');
      return res.json(result);
    }

    const broadcast = await clusterSyncService.broadcastSync('push');
    return res.json(broadcast);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: errMsg });
  }
});

/**
 * GET /api/cluster/sync/pull
 * Expose local payload & checksum for peers (authenticated by Cluster Secret or Admin)
 */
router.get('/sync/pull', async (req: Request, res: Response) => {
  const secretHeader = (req.headers['x-cluster-secret'] || '') as string;
  const clusterSecret = clusterService.getSettings().clusterSecret;

  if (secretHeader !== clusterSecret) {
    return res.status(401).json({ error: 'Unauthorized: Invalid cluster secret' });
  }

  try {
    const payload = await clusterSyncService.exportSyncPayload();
    const haStatus = await clusterService.getKeaHaStatus();
    return res.json({
      ...payload,
      haStatus
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: errMsg });
  }
});

/**
 * POST /api/cluster/sync/receive
 * Internal peer endpoint to receive and apply synced configuration
 */
router.post('/sync/receive', async (req: Request, res: Response) => {
  const secretHeader = (req.headers['x-cluster-secret'] || '') as string;
  try {
    const result = await clusterSyncService.receiveSyncPayload(req.body, secretHeader);
    return res.json(result);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const status = errMsg.includes('Unauthorized') ? 401 : 400;
    return res.status(status).json({ success: false, error: errMsg });
  }
});

/**
 * GET /api/cluster/sync/diff/:nodeId
 * Compare configuration difference between local and target node
 */
router.get('/sync/diff/:nodeId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const diff = await clusterSyncService.getDiffWithNode(req.params.nodeId);
    return res.json(diff);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: errMsg });
  }
});

/**
 * GET /api/cluster/sync/logs
 * Retrieve recent sync history logs
 */
router.get('/sync/logs', authMiddleware, (_req: Request, res: Response) => {
  try {
    const logs = clusterService.getSyncLogs();
    return res.json(logs);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: errMsg });
  }
});

/**
 * POST /api/cluster/ha/action
 * Trigger Kea HA commands (e.g. ha-sync)
 */
router.post('/ha/action', authMiddleware, async (req: Request, res: Response) => {
  const { action } = req.body || {};
  try {
    if (action === 'ha-sync') {
      const result = await clusterService.triggerKeaHaSync();
      return res.json(result);
    }
    return res.status(400).json({ error: `Unknown HA action: ${action}` });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: errMsg });
  }
});

export default router;
