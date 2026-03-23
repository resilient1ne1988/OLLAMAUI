const { getDb } = require('../db/db')
const { randomUUID } = require('crypto')

function createClaim({ messageId, text, supportTypes = [], evidenceRefs = [], contradictionRefs = [], confidenceNote, regenerateEligible = true }) {
  const db = getDb()
  const id = randomUUID()
  db.prepare(`INSERT INTO claims (id, message_id, text, support_types_json, evidence_refs_json, contradiction_refs_json, confidence_note, regenerate_eligible)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, messageId, text, JSON.stringify(supportTypes), JSON.stringify(evidenceRefs), JSON.stringify(contradictionRefs), confidenceNote || null, regenerateEligible ? 1 : 0)
  return getClaim(id)
}

function getClaim(id) {
  const r = getDb().prepare('SELECT * FROM claims WHERE id = ?').get(id)
  if (!r) return null
  return {
    id: r.id, messageId: r.message_id, text: r.text,
    supportTypes: JSON.parse(r.support_types_json || '[]'),
    evidenceRefs: JSON.parse(r.evidence_refs_json || '[]'),
    contradictionRefs: JSON.parse(r.contradiction_refs_json || '[]'),
    confidenceNote: r.confidence_note || undefined,
    regenerateEligible: !!r.regenerate_eligible,
    createdAt: r.created_at,
  }
}

function getClaimsForMessage(messageId) {
  return getDb().prepare('SELECT * FROM claims WHERE message_id = ? ORDER BY rowid ASC').all(messageId).map(r => getClaim(r.id))
}

function addEvidenceRef({ claimId, sourceId, modality, label, excerpt, pageNumber, timestampStartMs, timestampEndMs, bbox, confidence }) {
  const db = getDb()
  const id = randomUUID()
  db.prepare(`INSERT INTO evidence_refs (id, claim_id, source_id, modality, label, excerpt, page_number, timestamp_start_ms, timestamp_end_ms, bbox_json, confidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, claimId, sourceId, modality, label, excerpt || null, pageNumber ?? null, timestampStartMs ?? null, timestampEndMs ?? null, bbox ? JSON.stringify(bbox) : null, confidence ?? null)
  return { id, claimId, sourceId, modality, label, excerpt, pageNumber, timestampStartMs, timestampEndMs, bbox, confidence }
}

function getEvidenceForClaim(claimId) {
  return getDb().prepare('SELECT * FROM evidence_refs WHERE claim_id = ?').all(claimId).map(r => ({
    id: r.id, claimId: r.claim_id, sourceId: r.source_id, modality: r.modality, label: r.label,
    excerpt: r.excerpt || undefined, pageNumber: r.page_number ?? undefined,
    timestampStartMs: r.timestamp_start_ms ?? undefined, timestampEndMs: r.timestamp_end_ms ?? undefined,
    bbox: r.bbox_json ? JSON.parse(r.bbox_json) : undefined, confidence: r.confidence ?? undefined,
  }))
}

function saveMessage({ id, workspaceId, role, content, metadata = {} }) {
  const db = getDb()
  const msgId = id || randomUUID()
  db.prepare(`INSERT OR REPLACE INTO messages (id, workspace_id, role, content, metadata_json) VALUES (?, ?, ?, ?, ?)`)
    .run(msgId, workspaceId, role, content, JSON.stringify(metadata))
  return { id: msgId, workspaceId, role, content, metadata }
}

function getMessagesForWorkspace(workspaceId, limit = 100) {
  return getDb().prepare('SELECT * FROM messages WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?').all(workspaceId, limit)
    .map(r => ({ id: r.id, workspaceId: r.workspace_id, role: r.role, content: r.content, createdAt: r.created_at, metadata: JSON.parse(r.metadata_json || '{}') }))
}

module.exports = { createClaim, getClaim, getClaimsForMessage, addEvidenceRef, getEvidenceForClaim, saveMessage, getMessagesForWorkspace }
