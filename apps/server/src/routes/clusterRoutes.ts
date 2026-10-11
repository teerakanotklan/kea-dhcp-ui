import express from 'express';
import authMiddleware from '../middleware/auth';
import clusterController from '../controllers/clusterController';

const router = express.Router();

// GET /api/cluster/overview
router.get('/overview', authMiddleware, clusterController.getOverview.bind(clusterController));

// GET /api/cluster/nodes
router.get('/nodes', authMiddleware, clusterController.getNodes.bind(clusterController));

// POST /api/cluster/nodes
router.post('/nodes', authMiddleware, clusterController.addNode.bind(clusterController));

// POST /api/cluster/pair
router.post('/pair', clusterController.pair.bind(clusterController));

// PUT /api/cluster/nodes/:id
router.put('/nodes/:id', authMiddleware, clusterController.updateNode.bind(clusterController));

// DELETE /api/cluster/nodes/:id
router.delete('/nodes/:id', authMiddleware, clusterController.deleteNode.bind(clusterController));

// POST /api/cluster/nodes/:id/test
router.post('/nodes/:id/test', authMiddleware, clusterController.testNodeConnection.bind(clusterController));

// GET /api/cluster/settings
router.get('/settings', authMiddleware, clusterController.getSettings.bind(clusterController));

// PUT /api/cluster/settings
router.put('/settings', authMiddleware, clusterController.updateSettings.bind(clusterController));

// POST /api/cluster/sync/push
router.post('/sync/push', authMiddleware, clusterController.pushSync.bind(clusterController));

// GET /api/cluster/sync/pull
router.get('/sync/pull', clusterController.pullSync.bind(clusterController));

// POST /api/cluster/sync/receive
router.post('/sync/receive', clusterController.receiveSync.bind(clusterController));

// GET /api/cluster/sync/diff/:nodeId
router.get('/sync/diff/:nodeId', authMiddleware, clusterController.getDiff.bind(clusterController));

// GET /api/cluster/sync/logs
router.get('/sync/logs', authMiddleware, clusterController.getSyncLogs.bind(clusterController));

// POST /api/cluster/sync/pull-from-node
router.post('/sync/pull-from-node', authMiddleware, clusterController.pullFromNode.bind(clusterController));

// POST /api/cluster/ha/action
router.post('/ha/action', authMiddleware, clusterController.triggerHaAction.bind(clusterController));

export default router;
