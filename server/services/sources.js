const { getDb } = require('../db/db')
const { randomUUID } = require('crypto')

function toRecord(row) {
  if (!row) return null
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    modality: row.modality,
    mimeType: row.mime_type || undefined,
    localPath: row.local_path || undefined,
    createdAt: row.created_at,
    metadata: JSON.parse(row.metadata_json || '{}'),
    extractionStatus: row.extraction_status,
    retentionPolicy: row.retention_policy,
    expiresAt: row.expires_at || undefined,
  }
}

function expiresAtFromPolicy(policy) {
  const now = Date.now()
  if (policy === '24h') return new Date(now + 86400000).toISOString()
  if (policy === '7d') return new Date(now + 7 * 86400000).toISOString()
  return null
}

function createSource({ workspaceId, name, modality, mimeType, localPath, metadata = {}, retentionPolicy = 'manual' }) {
  const db = getDb()
  const id = randomUUID()
  const expiresAt = expiresAtFromPolicy(retentionPolicy)
  db.prepare(`INSERT INTO sources (id, workspace_id, name, modality, mime_type, local_path, metadata_json, retention_policy, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, workspaceId, name, modality, mimeType || null, localPath || null, JSON.stringify(metadata), retentionPolicy, expiresAt)
  return getSource(id)
}

function getSource(id) {
  return toRecord(getDb().prepare('SELECT * FROM sources WHERE id = ?').get(id))
}

function listSources(workspaceId, { modality, status } = {}) {
  let q = 'SELECT * FROM sources WHERE workspace_id = ?'
  const params = [workspaceId]
  if (modality) { q += ' AND modality = ?'; params.push(modality) }
  if (status) { q += ' AND extraction_status = ?'; params.push(status) }
  q += ' ORDER BY created_at DESC'
  return getDb().prepare(q).all(...params).map(toRecord)
}

function updateExtractionStatus(id, status) {
  getDb().prepare('UPDATE sources SET extraction_status = ? WHERE id = ?').run(status, id)
  return getSource(id)
}

function deleteSource(id) {
  getDb().prepare('DELETE FROM sources WHERE id = ?').run(id)
}

function addChunk({ sourceId, chunkIndex, text, metadata = {} }) {
  const db = getDb()
  const id = randomUUID()
  db.prepare('INSERT INTO extracted_chunks (id, source_id, chunk_index, text, metadata_json) VALUES (?, ?, ?, ?, ?)')
    .run(id, sourceId, chunkIndex, text, JSON.stringify(metadata))
  return { id, sourceId, chunkIndex, text, metadata }
}

function getChunks(sourceId) {
  return getDb().prepare('SELECT * FROM extracted_chunks WHERE source_id = ? ORDER BY chunk_index ASC').all(sourceId)
    .map(r => ({ id: r.id, sourceId: r.source_id, chunkIndex: r.chunk_index, text: r.text, metadata: JSON.parse(r.metadata_json || '{}'), createdAt: r.created_at }))
}

function purgeExpiredSources() {
  const now = new Date().toISOString()
  const expired = getDb().prepare('SELECT id FROM sources WHERE expires_at IS NOT NULL AND expires_at <= ?').all(now)
  const stmt = getDb().prepare('DELETE FROM sources WHERE id = ?')
  expired.forEach(r => stmt.run(r.id))
  return expired.length
}

module.exports = { createSource, getSource, listSources, updateExtractionStatus, deleteSource, addChunk, getChunks, purgeExpiredSources }
