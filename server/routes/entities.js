'use strict';
const express = require('express');
const router = express.Router();
const svc = require('../services/entityService');

function ok(res, data) { res.json({ ok: true, data }); }
function err(res, e, status = 500) { res.status(status).json({ ok: false, error: e.message || String(e) }); }

// GET /api/entities/:workspaceId
router.get('/:workspaceId', (req, res) => {
  try { ok(res, svc.getEntitiesForWorkspace(req.params.workspaceId)); }
  catch (e) { err(res, e); }
});

// POST /api/entities
router.post('/', (req, res) => {
  try {
    const { workspaceId, name, entityType, description, aliases } = req.body;
    if (!workspaceId || !name || !entityType) return err(res, new Error('workspaceId, name, entityType required'), 400);
    ok(res, svc.createEntity({ workspaceId, name, entityType, description, aliases }));
  } catch (e) { err(res, e); }
});

// GET /api/entities/detail/:entityId
router.get('/detail/:entityId', (req, res) => {
  try {
    const entity = svc.getEntity(req.params.entityId);
    if (!entity) return err(res, new Error('Entity not found'), 404);
    ok(res, entity);
  } catch (e) { err(res, e); }
});

// PATCH /api/entities/:entityId
router.patch('/:entityId', (req, res) => {
  try { ok(res, svc.updateEntity(req.params.entityId, req.body)); }
  catch (e) { err(res, e); }
});

// DELETE /api/entities/:entityId
router.delete('/:entityId', (req, res) => {
  try { svc.deleteEntity(req.params.entityId); ok(res, null); }
  catch (e) { err(res, e); }
});

// POST /api/entities/suggest
router.post('/suggest', (req, res) => {
  try {
    const { workspaceId, text } = req.body;
    if (!workspaceId || !text) return err(res, new Error('workspaceId and text required'), 400);
    ok(res, svc.suggestEntityLinks(text, workspaceId));
  } catch (e) { err(res, e); }
});

// POST /api/entities/:workspaceId/extract
router.post('/:workspaceId/extract', (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return err(res, new Error('text required'), 400);
    const entities = svc.extractEntitiesFromText(text);
    res.json({ entities });
  } catch (e) { err(res, e); }
});

// POST /api/entities/:entityId/claims/:claimId
router.post('/:entityId/claims/:claimId', (req, res) => {
  try { svc.addClaimToEntity(req.params.entityId, req.params.claimId); ok(res, null); }
  catch (e) { err(res, e); }
});

module.exports = router;
