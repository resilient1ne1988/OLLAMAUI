const { Router } = require('express')
const { createClaim, getClaim, getClaimsForMessage, addEvidenceRef, getEvidenceForClaim, saveMessage, getMessagesForWorkspace } = require('../services/evidence')
const { segmentIntoClaims, classifyClaims } = require('../services/claimSegmenter')

const router = Router()

const ok = (res, data) => res.json({ ok: true, data })
const err = (res, msg, status = 400) => res.status(status).json({ ok: false, error: msg })

// ─── Messages ─────────────────────────────────────────────────────────────────

router.get('/workspaces/:workspaceId/messages', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500)
    ok(res, getMessagesForWorkspace(req.params.workspaceId, limit))
  } catch (e) { err(res, e.message, 500) }
})

router.post('/workspaces/:workspaceId/messages', (req, res) => {
  const { id, role, content, metadata } = req.body || {}
  if (!role || !content) return err(res, 'role and content are required')
  const VALID_ROLES = ['user', 'assistant', 'system', 'tool']
  if (!VALID_ROLES.includes(role)) return err(res, `role must be one of: ${VALID_ROLES.join(', ')}`)
  try { ok(res, saveMessage({ id, workspaceId: req.params.workspaceId, role, content, metadata })) }
  catch (e) { err(res, e.message, 500) }
})

// ─── Claims ───────────────────────────────────────────────────────────────────

// Segment text into claims, classify, persist, and return the full list
router.post('/messages/:messageId/claims/segment', (req, res) => {
  const { text, sources } = req.body || {}
  if (!text) return err(res, 'text is required')
  const { messageId } = req.params
  try {
    const raw = segmentIntoClaims(text, messageId)
    const classified = classifyClaims(raw, sources || [])
    const saved = classified.map(c =>
      createClaim({
        messageId: c.messageId,
        text: c.text,
        supportTypes: c.supportTypes,
        evidenceRefs: c.evidenceRefs,
        contradictionRefs: c.contradictionRefs,
        regenerateEligible: c.regenerateEligible,
      })
    )
    // Populate evidence refs from the DB for each persisted claim
    const populated = saved.map(c => ({
      ...c,
      evidenceRefs: getEvidenceForClaim(c.id),
    }))
    ok(res, populated)
  } catch (e) { err(res, e.message, 500) }
})

// Return all claims for a message with evidence refs populated
router.get('/messages/:messageId/claims', (req, res) => {
  try {
    const claims = getClaimsForMessage(req.params.messageId)
    const populated = claims.map(c => ({
      ...c,
      evidenceRefs: getEvidenceForClaim(c.id),
    }))
    ok(res, populated)
  } catch (e) { err(res, e.message, 500) }
})

router.post('/messages/:messageId/claims', (req, res) => {
  const { text, supportTypes, evidenceRefs, contradictionRefs, confidenceNote, regenerateEligible } = req.body || {}
  if (!text) return err(res, 'text is required')
  try {
    ok(res, createClaim({ messageId: req.params.messageId, text, supportTypes, evidenceRefs, contradictionRefs, confidenceNote, regenerateEligible }))
  } catch (e) { err(res, e.message, 500) }
})

router.get('/claims/:claimId', (req, res) => {
  try {
    const claim = getClaim(req.params.claimId)
    if (!claim) return err(res, 'Claim not found', 404)
    ok(res, claim)
  } catch (e) { err(res, e.message, 500) }
})

// ─── Evidence refs ────────────────────────────────────────────────────────────

router.get('/claims/:claimId/evidence', (req, res) => {
  try { ok(res, getEvidenceForClaim(req.params.claimId)) }
  catch (e) { err(res, e.message, 500) }
})

router.post('/claims/:claimId/evidence', (req, res) => {
  const { sourceId, modality, label, excerpt, pageNumber, timestampStartMs, timestampEndMs, bbox, confidence } = req.body || {}
  if (!sourceId || !modality || !label) return err(res, 'sourceId, modality, label are required')
  try {
    ok(res, addEvidenceRef({ claimId: req.params.claimId, sourceId, modality, label, excerpt, pageNumber, timestampStartMs, timestampEndMs, bbox, confidence }))
  } catch (e) { err(res, e.message, 500) }
})

module.exports = router
