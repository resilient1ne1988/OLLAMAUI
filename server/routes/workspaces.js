const { Router } = require('express')
const { createWorkspace, getWorkspace, listWorkspaces, updateWorkspace, deleteWorkspace, ensureDefaultWorkspace, getWorkspaceContext } = require('../services/workspace')
const { createSource, listSources, getSource, deleteSource } = require('../services/sources')
const { extractSource } = require('../services/extraction/index')

const router = Router()

const ok = (res, data) => res.json({ ok: true, data })
const err = (res, msg, status = 400) => res.status(status).json({ ok: false, error: msg })

// ─── Workspaces ───────────────────────────────────────────────────────────────

router.get('/', (_req, res) => {
  try { ok(res, listWorkspaces()) } catch (e) { err(res, e.message, 500) }
})

router.post('/', (req, res) => {
  const { name, description, retentionPolicyDefault } = req.body || {}
  if (!name || typeof name !== 'string') return err(res, 'name is required')
  try { ok(res, createWorkspace({ name: name.trim(), description, retentionPolicyDefault })) }
  catch (e) { err(res, e.message, 500) }
})

router.get('/:id', (req, res) => {
  try {
    const ws = getWorkspace(req.params.id)
    if (!ws) return err(res, 'Workspace not found', 404)
    ok(res, ws)
  } catch (e) { err(res, e.message, 500) }
})

router.patch('/:id', (req, res) => {
  try {
    const ws = updateWorkspace(req.params.id, req.body || {})
    if (!ws) return err(res, 'Workspace not found', 404)
    ok(res, ws)
  } catch (e) { err(res, e.message, 500) }
})

router.delete('/:id', (req, res) => {
  try { deleteWorkspace(req.params.id); res.json({ ok: true }) }
  catch (e) { err(res, e.message, 500) }
})

router.get('/:id/context', (req, res) => {
  try { ok(res, getWorkspaceContext(req.params.id)) }
  catch (e) { err(res, e.message, 500) }
})

// ─── Sources (nested under workspace) ────────────────────────────────────────

router.get('/:id/sources', (req, res) => {
  try {
    const { modality, status } = req.query
    ok(res, listSources(req.params.id, { modality, status }))
  } catch (e) { err(res, e.message, 500) }
})

router.post('/:id/sources', async (req, res) => {
  const { name, modality, mimeType, localPath, metadata, retentionPolicy } = req.body || {}
  if (!name) return err(res, 'name is required')
  if (!modality) return err(res, 'modality is required')
  const VALID_MODALITIES = ['text', 'pdf', 'image', 'audio', 'tool', 'transcript', 'screenshot']
  if (!VALID_MODALITIES.includes(modality)) return err(res, `modality must be one of: ${VALID_MODALITIES.join(', ')}`)
  try {
    const source = createSource({ workspaceId: req.params.id, name, modality, mimeType, localPath, metadata, retentionPolicy })
    // kick off extraction async (don't await — respond immediately)
    extractSource(source).catch(e => console.error('[routes/workspaces] extraction error:', e.message))
    ok(res, source)
  } catch (e) { err(res, e.message, 500) }
})

router.get('/:id/sources/:sourceId', (req, res) => {
  try {
    const source = getSource(req.params.sourceId)
    if (!source || source.workspaceId !== req.params.id) return err(res, 'Source not found', 404)
    ok(res, source)
  } catch (e) { err(res, e.message, 500) }
})

router.delete('/:id/sources/:sourceId', (req, res) => {
  try {
    const source = getSource(req.params.sourceId)
    if (!source || source.workspaceId !== req.params.id) return err(res, 'Source not found', 404)
    deleteSource(req.params.sourceId)
    res.json({ ok: true })
  } catch (e) { err(res, e.message, 500) }
})

module.exports = router
module.exports.ensureDefaultWorkspace = ensureDefaultWorkspace
