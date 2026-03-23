import React, { useEffect } from 'react'
import useConflictDetector from '../../hooks/useConflictDetector'
import ConflictPanel from './ConflictPanel'
import './ConflictCenter.css'

export default function ConflictBanner({ workspaceId, messageId }) {
  const { conflicts, loading, expanded, detect, resolveConflict, toggleExpanded } = useConflictDetector(workspaceId)

  useEffect(() => {
    if (messageId) detect(messageId)
  }, [messageId, detect])

  if (loading || conflicts.length === 0) return null

  const unresolved = conflicts.filter(c => !c.resolved)
  const allResolved = unresolved.length === 0

  const severityCounts = unresolved.reduce((acc, c) => {
    acc[c.severity] = (acc[c.severity] || 0) + 1
    return acc
  }, {})

  if (allResolved) {
    return (
      <div className="conflict-banner all-resolved">
        ✅ All conflicts resolved
      </div>
    )
  }

  const severityText = ['high', 'medium', 'low']
    .filter(s => severityCounts[s])
    .map(s => `${severityCounts[s]} ${s}`)
    .join(', ')

  return (
    <div>
      <div className="conflict-banner has-conflicts" onClick={toggleExpanded} role="button" aria-expanded={expanded}>
        <span>⚡ {unresolved.length} Conflict{unresolved.length !== 1 ? 's' : ''} Detected</span>
        {severityText && <span className="conflict-banner-severity">({severityText})</span>}
        <span className="conflict-banner-chevron">{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <ConflictPanel conflicts={conflicts} onResolve={resolveConflict} />
      )}
    </div>
  )
}
