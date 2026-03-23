const { randomUUID } = require('crypto')
const { getDb } = require('../db/db')

// Extract numbers with their surrounding context words
function extractNumbersWithContext(text) {
  const results = []
  const pattern = /(\w[\w\s]{0,20}?)\s*([\d,]+\.?\d*)\s*([\w\s]{0,20}\w)?/g
  let m
  while ((m = pattern.exec(text)) !== null) {
    const raw = m[2].replace(/,/g, '')
    const num = parseFloat(raw)
    if (!isNaN(num)) {
      results.push({ num, context: (m[1] || '') + ' ' + (m[3] || ''), full: m[0] })
    }
  }
  return results
}

// Extract date-like patterns with surrounding words
function extractDatesWithContext(text) {
  const results = []
  // matches things like "Jan 2023", "2023-01-15", "January 15, 2023", "15/01/2023"
  const pattern = /([a-zA-Z][\w\s]{0,20}?)?\s*(\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4})\b)\s*([a-zA-Z][\w\s]{0,20})?/g
  let m
  while ((m = pattern.exec(text)) !== null) {
    results.push({ date: m[2], context: (m[1] || '') + ' ' + (m[3] || ''), full: m[0] })
  }
  return results
}

// Extract "X is Y" / "X is not Y" patterns
function extractBooleanClaims(text) {
  const results = []
  const posPattern = /(\b[\w\s]{2,30}?)\s+(?:is|are|was|were)\s+([\w\s]{1,30})/gi
  const negPattern = /(\b[\w\s]{2,30}?)\s+(?:is not|are not|isn't|aren't|was not|wasn't|were not|weren't)\s+([\w\s]{1,30})/gi
  let m
  while ((m = posPattern.exec(text)) !== null) {
    results.push({ subject: m[1].trim(), predicate: m[2].trim(), negated: false })
  }
  while ((m = negPattern.exec(text)) !== null) {
    results.push({ subject: m[1].trim(), predicate: m[2].trim(), negated: true })
  }
  return results
}

// Shared keyword overlap check
function keywordOverlap(a, b, minShared = 1) {
  const stop = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'of', 'to', 'for', 'and', 'or'])
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !stop.has(w)))
  const wordsB = b.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !stop.has(w))
  const shared = wordsB.filter(w => wordsA.has(w))
  return shared.length >= minShared ? shared : null
}

function detectConflicts(claims, workspaceId) {
  const conflicts = []

  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const claimA = claims[i]
      const claimB = claims[j]

      // ── 1. Number conflicts ──────────────────────────────────────────────────
      const numsA = extractNumbersWithContext(claimA.text)
      const numsB = extractNumbersWithContext(claimB.text)

      for (const na of numsA) {
        for (const nb of numsB) {
          if (na.num !== nb.num) {
            const shared = keywordOverlap(na.context + ' ' + claimA.text.slice(0, 60), nb.context + ' ' + claimB.text.slice(0, 60), 2)
            if (shared) {
              conflicts.push({
                id: randomUUID(),
                workspaceId,
                subject: shared.slice(0, 3).join(', '),
                field: 'numeric value',
                sourceRefA: claimA.id,
                sourceRefB: claimB.id,
                valueA: na.full.trim(),
                valueB: nb.full.trim(),
                severity: Math.abs(na.num - nb.num) / Math.max(na.num, nb.num) > 0.5 ? 'high' : 'medium',
                explanation: `Claim A states "${na.full.trim()}" while Claim B states "${nb.full.trim()}" — different numbers in similar context (${shared.slice(0, 3).join(', ')}).`,
                resolved: false,
                authoritativeSourceRefId: undefined,
              })
            }
          }
        }
      }

      // ── 2. Boolean / negation conflicts ─────────────────────────────────────
      const boolA = extractBooleanClaims(claimA.text)
      const boolB = extractBooleanClaims(claimB.text)

      for (const ba of boolA) {
        for (const bb of boolB) {
          const subjectOverlap = keywordOverlap(ba.subject, bb.subject, 1)
          const predicateOverlap = keywordOverlap(ba.predicate, bb.predicate, 1)
          if (subjectOverlap && predicateOverlap && ba.negated !== bb.negated) {
            conflicts.push({
              id: randomUUID(),
              workspaceId,
              subject: ba.subject,
              field: 'truth value',
              sourceRefA: claimA.id,
              sourceRefB: claimB.id,
              valueA: `${ba.subject} is ${ba.negated ? 'not ' : ''}${ba.predicate}`,
              valueB: `${bb.subject} is ${bb.negated ? 'not ' : ''}${bb.predicate}`,
              severity: 'high',
              explanation: `Claim A asserts "${ba.subject} is ${ba.negated ? 'not ' : ''}${ba.predicate}" while Claim B asserts the opposite.`,
              resolved: false,
              authoritativeSourceRefId: undefined,
            })
          }
        }
      }

      // ── 3. Date conflicts ────────────────────────────────────────────────────
      const datesA = extractDatesWithContext(claimA.text)
      const datesB = extractDatesWithContext(claimB.text)

      for (const da of datesA) {
        for (const db of datesB) {
          if (da.date !== db.date) {
            const shared = keywordOverlap(da.context + ' ' + claimA.text.slice(0, 60), db.context + ' ' + claimB.text.slice(0, 60), 2)
            if (shared) {
              conflicts.push({
                id: randomUUID(),
                workspaceId,
                subject: shared.slice(0, 3).join(', '),
                field: 'date',
                sourceRefA: claimA.id,
                sourceRefB: claimB.id,
                valueA: da.full.trim(),
                valueB: db.full.trim(),
                severity: 'medium',
                explanation: `Claim A references date "${da.date}" while Claim B references "${db.date}" in similar context (${shared.slice(0, 3).join(', ')}).`,
                resolved: false,
                authoritativeSourceRefId: undefined,
              })
            }
          }
        }
      }
    }
  }

  return conflicts
}

function saveConflict(conflict) {
  const db = getDb()
  db.prepare(`
    INSERT OR IGNORE INTO conflicts
      (id, workspace_id, subject, field, source_ref_a, source_ref_b, value_a, value_b, severity, explanation, resolved, authoritative_source_ref_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    conflict.id,
    conflict.workspaceId,
    conflict.subject,
    conflict.field,
    conflict.sourceRefA,
    conflict.sourceRefB,
    conflict.valueA,
    conflict.valueB,
    conflict.severity,
    conflict.explanation,
    conflict.resolved ? 1 : 0,
    conflict.authoritativeSourceRefId || null,
  )
}

function getConflictsForWorkspace(workspaceId) {
  return getDb()
    .prepare('SELECT * FROM conflicts WHERE workspace_id = ? AND resolved = 0 ORDER BY created_at DESC')
    .all(workspaceId)
    .map(r => ({
      id: r.id,
      workspaceId: r.workspace_id,
      subject: r.subject,
      field: r.field,
      sourceRefA: r.source_ref_a,
      sourceRefB: r.source_ref_b,
      valueA: r.value_a,
      valueB: r.value_b,
      severity: r.severity,
      explanation: r.explanation,
      resolved: !!r.resolved,
      authoritativeSourceRefId: r.authoritative_source_ref_id || undefined,
      createdAt: r.created_at,
    }))
}

function resolveConflict(conflictId, authoritativeSourceRefId) {
  getDb()
    .prepare('UPDATE conflicts SET resolved = 1, authoritative_source_ref_id = ? WHERE id = ?')
    .run(authoritativeSourceRefId || null, conflictId)
}

module.exports = { detectConflicts, saveConflict, getConflictsForWorkspace, resolveConflict }
