import { Request, Response } from 'express';
import clusterService from '../services/clusterService';
import clusterSyncService from '../services/clusterSyncService';
import authService from '../services/authService';
import { ClusterNodeSchema, ClusterSettingsSchema } from '@kea/shared';

export class ClusterController {
  async getOverview(_req: Request, res: Response) {
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
  }

  getNodes(_req: Request, res: Response) {
    try {
      const nodes = clusterService.getNodes();
      return res.json(nodes);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: errMsg });
    }
  }

  async addNode(req: Request, res: Response) {
    try {
      const parsed = ClusterNodeSchema.omit({ id: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || 'Invalid node data' });
      }

      const { adminPassword, enableHa, clusterMode, clusterSecret } = req.body || {};
      if (enableHa !== undefined || clusterMode || clusterSecret) {
        await clusterService.updateSettings({
          ...(enableHa !== undefined ? { enabled: Boolean(enableHa) } : { enabled: true }),
          ...(clusterMode ? { mode: clusterMode } : {}),
          ...(clusterSecret ? { clusterSecret } : {})
        });
      }
      const created = await clusterService.addNode(parsed.data, adminPassword);
      return res.status(201).json(created);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ error: errMsg });
    }
  }

  async pair(req: Request, res: Response) {
    try {
      const secretHeader = (req.headers['x-cluster-secret'] || '') as string;
      const currentSettings = clusterService.getSettings();
      const { adminPassword, clusterSecret } = req.body || {};

      const isUnclustered = !currentSettings.enabled;
      const secretMatch = Boolean(secretHeader && secretHeader === currentSettings.clusterSecret);
      const initialMatch = Boolean(clusterSecret && clusterSecret === currentSettings.clusterSecret);
      let passwordMatch = false;

      if (adminPassword) {
        try {
          const authRes = authService.authenticate('admin', adminPassword);
          passwordMatch = Boolean(authRes && authRes.success);
        } catch {
          passwordMatch = false;
        }
      }

      if (!isUnclustered && !secretMatch && !initialMatch && !passwordMatch) {
        return res.status(401).json({
          error: 'Unauthorized: Cluster pairing requires matching cluster secret or valid admin credentials'
        });
      }

      const result = await clusterService.pairWithCluster(req.body);
      return res.json(result);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: errMsg });
    }
  }

  async updateNode(req: Request, res: Response) {
    try {
      const updated = await clusterService.updateNode(req.params.id, req.body);
      return res.json(updated);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ error: errMsg });
    }
  }

  async deleteNode(req: Request, res: Response) {
    try {
      await clusterService.deleteNode(req.params.id);
      return res.json({ success: true, message: 'Node deleted successfully' });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ error: errMsg });
    }
  }

  async testNodeConnection(req: Request, res: Response) {
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
  }

  getSettings(_req: Request, res: Response) {
    try {
      const settings = clusterService.getSettings();
      return res.json(settings);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: errMsg });
    }
  }

  async updateSettings(req: Request, res: Response) {
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
  }

  async pushSync(req: Request, res: Response) {
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
  }

  async pullSync(req: Request, res: Response) {
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
  }

  async receiveSync(req: Request, res: Response) {
    const secretHeader = (req.headers['x-cluster-secret'] || '') as string;
    try {
      const result = await clusterSyncService.receiveSyncPayload(req.body, secretHeader);
      return res.json(result);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const status = errMsg.includes('Unauthorized') ? 401 : 400;
      return res.status(status).json({ success: false, error: errMsg });
    }
  }

  async getDiff(req: Request, res: Response) {
    try {
      const diff = await clusterSyncService.getDiffWithNode(req.params.nodeId);
      return res.json(diff);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: errMsg });
    }
  }

  getSyncLogs(_req: Request, res: Response) {
    try {
      const logs = clusterService.getSyncLogs();
      return res.json(logs);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: errMsg });
    }
  }

  async pullFromNode(req: Request, res: Response) {
    const { nodeId } = req.body || {};
    try {
      let targetNodeId = nodeId;
      if (!targetNodeId) {
        // Auto-select primary node if not specified
        const primary = clusterService.getNodes().find((n) => !n.isLocal && n.role === 'primary');
        if (primary) {
          targetNodeId = primary.id;
        } else {
          const firstRemote = clusterService.getNodes().find((n) => !n.isLocal);
          targetNodeId = firstRemote?.id;
        }
      }

      if (!targetNodeId) {
        return res.status(400).json({ error: 'No remote partner node available to pull configuration from' });
      }

      const result = await clusterSyncService.pullFromNode(targetNodeId);
      return res.json(result);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: errMsg });
    }
  }

  async triggerHaAction(req: Request, res: Response) {
    const { action, serverName } = req.body || {};
    try {
      if (action === 'ha-sync') {
        const result = await clusterService.triggerKeaHaSync(serverName);
        return res.json(result);
      }
      return res.status(400).json({ error: `Unknown HA action: ${action}` });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: errMsg });
    }
  }
}

export default new ClusterController();
