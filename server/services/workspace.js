const { getDb } = require('../db/db')
const { randomUUID } = require('crypto')

function toWorkspace(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    retentionPolicyDefault: row.retention_policy_default,
  }
}

function createWorkspace({ name, description, retentionPolicyDefault = 'manual' }) {
  const db = getDb()
  const id = randomUUID()
  db.prepare('INSERT INTO workspaces (id, name, description, retention_policy_default) VALUES (?, ?, ?, ?)')
    .run(id, name, description || null, retentionPolicyDefault)
  return getWorkspace(id)
}

function getWorkspace(id) {
  return toWorkspace(getDb().prepare('SELECT * FROM workspaces WHERE id = ?').get(id))
}

function listWorkspaces() {
  return getDb().prepare('SELECT * FROM workspaces ORDER BY updated_at DESC').all().map(toWorkspace)
}

function updateWorkspace(id, patch) {
  const db = getDb()
  const now = new Date().toISOString()
  const fields = []
  const vals = []
  if (patch.name !== undefined) { fields.push('name = ?'); vals.push(patch.name) }
  if (patch.description !== undefined) { fields.push('description = ?'); vals.push(patch.description) }
  if (patch.retentionPolicyDefault !== undefined) { fields.push('retention_policy_default = ?'); vals.push(patch.retentionPolicyDefault) }
  fields.push('updated_at = ?'); vals.push(now)
  if (!fields.length) return getWorkspace(id)
  db.prepare(`UPDATE workspaces SET ${fields.join(', ')} WHERE id = ?`).run(...vals, id)
  return getWorkspace(id)
}

function deleteWorkspace(id) {
  getDb().prepare('DELETE FROM workspaces WHERE id = ?').run(id)
}

function ensureDefaultWorkspace() {
  const db = getDb()
  const existing = db.prepare("SELECT * FROM workspaces WHERE name = 'Default' LIMIT 1").get()
  if (existing) return toWorkspace(existing)
  return createWorkspace({ name: 'Default', description: 'Default workspace' })
}

function getWorkspaceContext(workspaceId) {
  const db = getDb()
  const now = new Date().toISOString()
  const sources = db.prepare(`SELECT * FROM sources WHERE workspace_id = ? AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC`).all(workspaceId, now)
  const entities = db.prepare('SELECT * FROM entities WHERE workspace_id = ?').all(workspaceId)
  const conflicts = db.prepare('SELECT * FROM conflicts WHERE workspace_id = ? AND resolved = 0').all(workspaceId)
  return {
    workspaceId,
    activeSources: sources.length,
    activeEntities: entities.length,
    unresolvedConflicts: conflicts.length,
    sourcesByModality: sources.reduce((acc, s) => { acc[s.modality] = (acc[s.modality] || 0) + 1; return acc }, {}),
  }
}

module.exports = { createWorkspace, getWorkspace, listWorkspaces, updateWorkspace, deleteWorkspace, ensureDefaultWorkspace, getWorkspaceContext }
