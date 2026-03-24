'use strict';
const { getDb } = require('../db/db');
const { randomUUID } = require('crypto');

function parseEntity(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    entityType: row.entity_type,
    description: row.description || '',
    aliases: JSON.parse(row.aliases_json || '[]'),
    sourceRefs: JSON.parse(row.source_refs_json || '[]'),
    claimRefs: JSON.parse(row.claim_refs_json || '[]'),
    relatedEntityIds: JSON.parse(row.related_entity_ids_json || '[]'),
    pinned: row.pinned === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createEntity({ workspaceId, name, entityType, description = '', aliases = [], sourceRefs = [], claimRefs = [], relatedEntityIds = [] }) {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO entities (id, workspace_id, name, entity_type, description, aliases_json, source_refs_json, claim_refs_json, related_entity_ids_json, pinned, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(id, workspaceId, name, entityType, description, JSON.stringify(aliases), JSON.stringify(sourceRefs), JSON.stringify(claimRefs), JSON.stringify(relatedEntityIds), now, now);
  return parseEntity(db.prepare('SELECT * FROM entities WHERE id = ?').get(id));
}

function getEntitiesForWorkspace(workspaceId) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM entities WHERE workspace_id = ? ORDER BY pinned DESC, name ASC').all(workspaceId);
  return rows.map(parseEntity);
}

function getEntity(id) {
  const db = getDb();
  return parseEntity(db.prepare('SELECT * FROM entities WHERE id = ?').get(id));
}

function updateEntity(id, patch) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM entities WHERE id = ?').get(id);
  if (!existing) throw new Error(`Entity ${id} not found`);

  const name = patch.name !== undefined ? patch.name : existing.name;
  const entityType = patch.entityType !== undefined ? patch.entityType : existing.entity_type;
  const description = patch.description !== undefined ? patch.description : (existing.description || '');
  const aliases = patch.aliases !== undefined ? patch.aliases : JSON.parse(existing.aliases_json || '[]');
  const sourceRefs = patch.sourceRefs !== undefined ? patch.sourceRefs : JSON.parse(existing.source_refs_json || '[]');
  const claimRefs = patch.claimRefs !== undefined ? patch.claimRefs : JSON.parse(existing.claim_refs_json || '[]');
  const relatedEntityIds = patch.relatedEntityIds !== undefined ? patch.relatedEntityIds : JSON.parse(existing.related_entity_ids_json || '[]');
  const pinned = patch.pinned !== undefined ? (patch.pinned ? 1 : 0) : existing.pinned;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE entities SET name=?, entity_type=?, description=?, aliases_json=?, source_refs_json=?, claim_refs_json=?, related_entity_ids_json=?, pinned=?, updated_at=?
    WHERE id=?
  `).run(name, entityType, description, JSON.stringify(aliases), JSON.stringify(sourceRefs), JSON.stringify(claimRefs), JSON.stringify(relatedEntityIds), pinned, now, id);

  return parseEntity(db.prepare('SELECT * FROM entities WHERE id = ?').get(id));
}

function deleteEntity(id) {
  const db = getDb();
  db.prepare('DELETE FROM entities WHERE id = ?').run(id);
}

function suggestEntityLinks(text, workspaceId) {
  const entities = getEntitiesForWorkspace(workspaceId);
  const lower = text.toLowerCase();
  return entities.filter(e => lower.includes(e.name.toLowerCase()));
}

function addClaimToEntity(entityId, claimId) {
  const db = getDb();
  const row = db.prepare('SELECT claim_refs_json FROM entities WHERE id = ?').get(entityId);
  if (!row) throw new Error(`Entity ${entityId} not found`);
  const refs = JSON.parse(row.claim_refs_json || '[]');
  if (!refs.includes(claimId)) {
    refs.push(claimId);
    db.prepare('UPDATE entities SET claim_refs_json=?, updated_at=? WHERE id=?')
      .run(JSON.stringify(refs), new Date().toISOString(), entityId);
  }
}

function extractEntitiesFromText(text) {
  const results = [];
  const seen = new Set();

  const add = (matchText, type) => {
    const t = matchText.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    results.push({ text: t, type });
  };

  const capPhrases = text.match(/\b([A-Z][a-z]+ )+[A-Z][a-z]+\b/g) || [];
  capPhrases.forEach(m => add(m, 'person_or_org'));

  const amounts = text.match(/\$[\d,]+(\.\d{2})?/g) || [];
  amounts.forEach(m => add(m, 'amount'));

  const dates = text.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b/gi) || [];
  dates.forEach(m => add(m, 'date'));

  const acronyms = text.match(/\b[A-Z]{2,6}\b/g) || [];
  acronyms.forEach(m => add(m, 'acronym'));

  return results.slice(0, 10);
}

module.exports = { createEntity, getEntitiesForWorkspace, getEntity, updateEntity, deleteEntity, suggestEntityLinks, addClaimToEntity, extractEntitiesFromText };
