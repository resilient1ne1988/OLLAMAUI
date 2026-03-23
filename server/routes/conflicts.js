const express = require('express')
const router = express.Router()
const { getDb } = require('../db/db')
const { detectConflicts, saveConflict, getConflictsForWorkspace, resolveConflict } = require('../services/conflictDetector')

// POST /api/conflicts/detect
router.post('/detect', (req, res) => {
  try {
    const { workspaceId, messageId } = req.body
    if (!workspaceId || !messageId) {
      return res.status(400).json({ ok: false, error: 'workspaceId and messageId are required' })
    }

    const db = getDb()

    // Fetch claims for the message
    const rawClaims = db.prepare('SELECT * FROM claims WHERE message_id = ?').all(messageId)
    const claims = rawClaims.map(r => ({
      id: r.id,
      messageId: r.message_id,
      text: r.text,
      supportTypes: JSON.parse(r.support_types_json || '[]'),
      evidenceRefs: JSON.parse(r.evidence_refs_json || '[]'),
      contradictionRefs: JSON.parse(r.contradiction_refs_json || '[]'),
    }))

    const conflicts = detectConflicts(claims, workspaceId)

    // Persist conflicts and link back to claims
    for (const conflict of conflicts) {
      saveConflict(conflict)

      // Update contradiction_refs_json for any claims that are source refs of this conflict
      for (const claim of claims) {
        if (claim.id === conflict.sourceRefA || claim.id === conflict.sourceRefB) {
          const existing = JSON.parse(
            db.prepare('SELECT contradiction_refs_json FROM claims WHERE id = ?').get(claim.id)?.contradiction_refs_json || '[]'
          )
          if (!existing.includes(conflict.id)) {
            existing.push(conflict.id)
            db.prepare('UPDATE claims SET contradiction_refs_json = ? WHERE id = ?')
              .run(JSON.stringify(existing), claim.id)
          }
        }
      }
    }

    res.json({ ok: true, data: conflicts })
  } catch (err) {
    console.error('[conflicts/detect]', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// GET /api/conflicts/:workspaceId
router.get('/:workspaceId', (req, res) => {
  try {
    const conflicts = getConflictsForWorkspace(req.params.workspaceId)
    res.json({ ok: true, data: conflicts })
  } catch (err) {
    console.error('[conflicts/get]', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// PATCH /api/conflicts/:conflictId/resolve
router.patch('/:conflictId/resolve', (req, res) => {
  try {
    const { authoritativeSourceRefId } = req.body || {}
    resolveConflict(req.params.conflictId, authoritativeSourceRefId)
    res.json({ ok: true })
  } catch (err) {
    console.error('[conflicts/resolve]', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

module.exports = router
