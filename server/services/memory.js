const { getDb } = require('../db/db')
const { randomUUID } = require('crypto')

const POLICY_DURATIONS = { '24h': 86400000, '7d': 7 * 86400000 }

function setMemoryPolicy({ targetType, targetId, retentionPolicy, inheritedFromId }) {
  const db = getDb()
  const id = randomUUID()
  const expiresAt = POLICY_DURATIONS[retentionPolicy] ? new Date(Date.now() + POLICY_DURATIONS[retentionPolicy]).toISOString() : null
  db.prepare(`INSERT INTO memory_policies (id, target_type, target_id, retention_policy, expires_at, inherited_from_id)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(target_type, target_id) DO UPDATE SET retention_policy=excluded.retention_policy, expires_at=excluded.expires_at, inherited_from_id=excluded.inherited_from_id`
  ).run(id, targetType, targetId, retentionPolicy, expiresAt, inheritedFromId || null)
  return getMemoryPolicy(targetType, targetId)
}

function getMemoryPolicy(targetType, targetId) {
  const r = getDb().prepare('SELECT * FROM memory_policies WHERE target_type = ? AND target_id = ?').get(targetType, targetId)
  if (!r) return null
  return { id: r.id, targetType: r.target_type, targetId: r.target_id, retentionPolicy: r.retention_policy, expiresAt: r.expires_at || undefined, inheritedFromId: r.inherited_from_id || undefined }
}

function listExpiringPolicies(withinMs = 86400000) {
  const cutoff = new Date(Date.now() + withinMs).toISOString()
  return getDb().prepare('SELECT * FROM memory_policies WHERE expires_at IS NOT NULL AND expires_at <= ?').all(cutoff)
    .map(r => ({ id: r.id, targetType: r.target_type, targetId: r.target_id, retentionPolicy: r.retention_policy, expiresAt: r.expires_at }))
}

function purgeExpiredPolicies() {
  const now = new Date().toISOString()
  const expired = getDb().prepare('SELECT * FROM memory_policies WHERE expires_at IS NOT NULL AND expires_at <= ?').all(now)
  let purged = 0
  for (const p of expired) {
    if (p.target_type === 'source') getDb().prepare('DELETE FROM sources WHERE id = ?').run(p.target_id)
    else if (p.target_type === 'claim') getDb().prepare('DELETE FROM claims WHERE id = ?').run(p.target_id)
    else if (p.target_type === 'entity') getDb().prepare('DELETE FROM entities WHERE id = ?').run(p.target_id)
    else if (p.target_type === 'conflict') getDb().prepare('DELETE FROM conflicts WHERE id = ?').run(p.target_id)
    else if (p.target_type === 'message') getDb().prepare('DELETE FROM messages WHERE id = ?').run(p.target_id)
    getDb().prepare('DELETE FROM memory_policies WHERE id = ?').run(p.id)
    purged++
  }
  return purged
}

function scheduleCleanup(intervalMs = 3600000) {
  const run = () => {
    try {
      const purged = purgeExpiredPolicies()
      if (purged > 0) console.log(`[memory] Purged ${purged} expired items`)
    } catch (e) {
      console.error('[memory] Cleanup error:', e.message)
    }
  }
  run()
  return setInterval(run, intervalMs)
}

function getExpiresAtForPolicy(policy) {
  if (policy === 'session') return new Date(Date.now() + 1000).toISOString()
  if (policy === '24h') return new Date(Date.now() + 86400000).toISOString()
  if (policy === '7d') return new Date(Date.now() + 604800000).toISOString()
  return null
}

function getExpiringItems(workspaceId, withinMs = 86400000) {
  const db = getDb()
  const cutoff = new Date(Date.now() + withinMs).toISOString()
  const now = new Date().toISOString()

  const sources = db.prepare(
    `SELECT * FROM sources WHERE workspace_id = ? AND expires_at IS NOT NULL AND expires_at <= ?`
  ).all(workspaceId, cutoff)

  const claimPolicies = db.prepare(
    `SELECT mp.*, c.content, c.workspace_id FROM memory_policies mp
     LEFT JOIN claims c ON c.id = mp.target_id
     WHERE mp.target_type = 'claim' AND mp.expires_at IS NOT NULL AND mp.expires_at <= ?`
  ).all(cutoff)

  const entityPolicies = db.prepare(
    `SELECT mp.*, e.name, e.workspace_id FROM memory_policies mp
     LEFT JOIN entities e ON e.id = mp.target_id
     WHERE mp.target_type = 'entity' AND mp.expires_at IS NOT NULL AND mp.expires_at <= ?`
  ).all(cutoff)

  const wsClaimPolicies = workspaceId
    ? claimPolicies.filter(r => !r.workspace_id || r.workspace_id === workspaceId)
    : claimPolicies

  const wsEntityPolicies = workspaceId
    ? entityPolicies.filter(r => !r.workspace_id || r.workspace_id === workspaceId)
    : entityPolicies

  return {
    sources: sources.map(s => ({ ...s, expired: s.expires_at <= now })),
    claims: wsClaimPolicies.map(r => ({
      id: r.target_id, content: r.content, retentionPolicy: r.retention_policy,
      expiresAt: r.expires_at, expired: r.expires_at <= now
    })),
    entities: wsEntityPolicies.map(r => ({
      id: r.target_id, name: r.name, retentionPolicy: r.retention_policy,
      expiresAt: r.expires_at, expired: r.expires_at <= now
    }))
  }
}

function runCascadeCleanup(workspaceId) {
  const db = getDb()
  const now = new Date().toISOString()
  const summary = { deleted: { sources: 0, claims: 0, entities: 0 }, orphaned: 0 }

  // Find expired sources via memory_policies
  const expiredSourcePolicies = db.prepare(
    `SELECT mp.target_id FROM memory_policies mp
     WHERE mp.target_type = 'source' AND mp.expires_at IS NOT NULL AND mp.expires_at <= ?`
  ).all(now)

  // Also find sources with direct expires_at
  let expiredSourcesQuery = `SELECT id FROM sources WHERE expires_at IS NOT NULL AND expires_at <= ?`
  const queryParams = [now]
  if (workspaceId) {
    expiredSourcesQuery += ` AND workspace_id = ?`
    queryParams.push(workspaceId)
  }
  const expiredSourcesDirect = db.prepare(expiredSourcesQuery).all(...queryParams)

  const expiredSourceIds = new Set([
    ...expiredSourcePolicies.map(r => r.target_id),
    ...expiredSourcesDirect.map(r => r.id)
  ])

  for (const sourceId of expiredSourceIds) {
    // CASCADE: claims referencing this source via evidence_refs JSON
    const allClaims = db.prepare(`SELECT id, evidence_refs FROM claims WHERE evidence_refs IS NOT NULL`).all()
    for (const claim of allClaims) {
      let refs = []
      try { refs = JSON.parse(claim.evidence_refs) } catch {}
      if (!Array.isArray(refs) || !refs.includes(sourceId)) continue

      // Check if claim has manual policy
      const claimPolicy = db.prepare(
        `SELECT retention_policy FROM memory_policies WHERE target_type = 'claim' AND target_id = ?`
      ).get(claim.id)
      if (claimPolicy?.retention_policy === 'manual') continue

      db.prepare(`DELETE FROM claims WHERE id = ?`).run(claim.id)
      db.prepare(`DELETE FROM memory_policies WHERE target_type = 'claim' AND target_id = ?`).run(claim.id)
      summary.deleted.claims++
    }

    // CASCADE: entities — remove sourceId from their source_refs JSON
    const allEntities = db.prepare(`SELECT id, source_refs FROM entities WHERE source_refs IS NOT NULL`).all()
    for (const entity of allEntities) {
      let refs = []
      try { refs = JSON.parse(entity.source_refs) } catch {}
      if (!Array.isArray(refs) || !refs.includes(sourceId)) continue

      const newRefs = refs.filter(r => r !== sourceId)
      db.prepare(`UPDATE entities SET source_refs = ? WHERE id = ?`).run(JSON.stringify(newRefs), entity.id)

      // Check if entity is now orphaned (no source_refs and no claim_refs)
      const updatedEntity = db.prepare(`SELECT source_refs, claim_refs FROM entities WHERE id = ?`).get(entity.id)
      let remainingSources = []
      let remainingClaims = []
      try { remainingSources = JSON.parse(updatedEntity?.source_refs || '[]') } catch {}
      try { remainingClaims = JSON.parse(updatedEntity?.claim_refs || '[]') } catch {}
      if (remainingSources.length === 0 && remainingClaims.length === 0) {
        db.prepare(`UPDATE entities SET orphaned = 1 WHERE id = ?`).run(entity.id)
        summary.orphaned++
      }
    }

    // CASCADE: conflicts referencing expired source
    db.prepare(
      `UPDATE conflicts SET resolved = 1, resolution = 'Source expired'
       WHERE source_ref_a = ? OR source_ref_b = ?`
    ).run(sourceId, sourceId)

    db.prepare(`DELETE FROM sources WHERE id = ?`).run(sourceId)
    db.prepare(`DELETE FROM memory_policies WHERE target_type = 'source' AND target_id = ?`).run(sourceId)
    summary.deleted.sources++
  }

  // Purge expired claim/entity policies directly
  const expiredClaimPolicies = db.prepare(
    `SELECT target_id FROM memory_policies WHERE target_type = 'claim' AND expires_at IS NOT NULL AND expires_at <= ? AND retention_policy != 'manual'`
  ).all(now)
  for (const { target_id } of expiredClaimPolicies) {
    db.prepare(`DELETE FROM claims WHERE id = ?`).run(target_id)
    db.prepare(`DELETE FROM memory_policies WHERE target_type = 'claim' AND target_id = ?`).run(target_id)
    summary.deleted.claims++
  }

  const expiredEntityPolicies = db.prepare(
    `SELECT target_id FROM memory_policies WHERE target_type = 'entity' AND expires_at IS NOT NULL AND expires_at <= ? AND retention_policy != 'manual'`
  ).all(now)
  for (const { target_id } of expiredEntityPolicies) {
    db.prepare(`UPDATE entities SET orphaned = 1 WHERE id = ?`).run(target_id)
    summary.orphaned++
    db.prepare(`DELETE FROM memory_policies WHERE target_type = 'entity' AND target_id = ?`).run(target_id)
  }

  return summary
}

module.exports = { setMemoryPolicy, getMemoryPolicy, listExpiringPolicies, purgeExpiredPolicies, scheduleCleanup, getExpiresAtForPolicy, getExpiringItems, runCascadeCleanup }
