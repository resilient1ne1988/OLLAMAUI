import React from 'react'
import './ConflictCenter.css'

const SEVERITY_LABEL = { high: '🔴 High', medium: '🟡 Medium', low: '⚪ Low' }

export default function ConflictCard({ conflict, onResolve }) {
  if (conflict.resolved) {
    return (
      <div className="conflict-card resolved">
        <div className="conflict-resolved-overlay">✅ Resolved</div>
        <div className="conflict-card-header">
          <span className="conflict-subject">{conflict.subject}</span>
          <span className={`severity-badge ${conflict.severity}`}>{SEVERITY_LABEL[conflict.severity]}</span>
        </div>
        <div className="conflict-field">Field: <strong>{conflict.field}</strong></div>
      </div>
    )
  }

  return (
    <div className="conflict-card">
      <div className="conflict-card-header">
        <span className="conflict-subject">{conflict.subject}</span>
        <span className={`severity-badge ${conflict.severity}`}>{SEVERITY_LABEL[conflict.severity]}</span>
      </div>
      <div className="conflict-field">Field: <strong>{conflict.field}</strong></div>

      <div className="conflict-vs">
        <div className="conflict-source">
          <div className="conflict-source-label">Source A says:</div>
          <div className="conflict-source-value">{conflict.valueA}</div>
        </div>
        <div className="conflict-vs-divider">vs</div>
        <div className="conflict-source">
          <div className="conflict-source-label">Source B says:</div>
          <div className="conflict-source-value">{conflict.valueB}</div>
        </div>
      </div>

      <div className="conflict-explanation">{conflict.explanation}</div>

      <div className="conflict-actions">
        <button className="btn-secondary btn-sm" onClick={() => onResolve(conflict.id, 'cautious')}>
          💬 Answer cautiously
        </button>
        <button className="btn-secondary btn-sm" onClick={() => onResolve(conflict.id, 'auth_a', conflict.sourceRefA)}>
          ✅ A is authoritative
        </button>
        <button className="btn-secondary btn-sm" onClick={() => onResolve(conflict.id, 'auth_b', conflict.sourceRefB)}>
          ✅ B is authoritative
        </button>
      </div>
    </div>
  )
}
