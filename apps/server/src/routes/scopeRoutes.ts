import express from 'express';
import authMiddleware from '../middleware/auth';
import scopeController from '../controllers/scopeController';

const router = express.Router();

// GET /api/scopes
router.get('/', authMiddleware, scopeController.getScopes.bind(scopeController));

// GET /api/scopes/:id
router.get('/:id', authMiddleware, scopeController.getScopeById.bind(scopeController));

// POST /api/scopes
router.post('/', authMiddleware, scopeController.createScope.bind(scopeController));

// PATCH /api/scopes/:id/toggle
router.patch('/:id/toggle', authMiddleware, scopeController.toggleScope.bind(scopeController));

// PUT /api/scopes/:id
router.put('/:id', authMiddleware, scopeController.updateScope.bind(scopeController));

// DELETE /api/scopes/:id
router.delete('/:id', authMiddleware, scopeController.deleteScope.bind(scopeController));

// --- Scope Reservations (Static Hosts) Endpoints ---

// POST /api/scopes/:id/reservations
router.post('/:id/reservations', authMiddleware, scopeController.addReservation.bind(scopeController));

// PUT /api/scopes/:id/reservations/:hwAddress
router.put('/:id/reservations/:hwAddress', authMiddleware, scopeController.updateReservation.bind(scopeController));

// DELETE /api/scopes/:id/reservations/:hwAddress
router.delete('/:id/reservations/:hwAddress', authMiddleware, scopeController.deleteReservation.bind(scopeController));

export default router;
