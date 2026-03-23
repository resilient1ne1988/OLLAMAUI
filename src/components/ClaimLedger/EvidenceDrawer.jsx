import React from 'react'

const MODALITY_ICON = {
  text:  '📄',
  image: '🖼️',
  audio: '🔊',
  video: '🎥',
  tool:  '🔧',
}

export default function EvidenceDrawer({ claim }) {
  const { evidenceRefs = [], contradictionRefs = [], confidenceNote } = claim

  return (
    <div className="evidence-drawer">
      {evidenceRefs.length === 0 && contradictionRefs.length === 0 ? (
        <p className="evidence-empty">No evidence linked — mark as unsupported</p>
      ) : (
        evidenceRefs.map(ref => (
          <div key={ref.id} className="evidence-ref-card">
            <span className="evidence-modality-icon">
              {MODALITY_ICON[ref.modality] || '📎'}
            </span>
            <span className="evidence-label">{ref.label}</span>
            {ref.excerpt && (
              <p className="evidence-excerpt">"{ref.excerpt}"</p>
            )}
            {ref.pageNumber != null && (
              <span className="evidence-meta">p.{ref.pageNumber}</span>
            )}
            {ref.confidence != null && (
              <span className="evidence-meta"> · {Math.round(ref.confidence * 100)}% confidence</span>
            )}
          </div>
        ))
      )}

      {contradictionRefs.length > 0 && (
        <div className="contradiction-section">
          <strong>⚠️ Contradiction detected</strong>
          {contradictionRefs.map((ref, i) => (
            <div key={i} className="evidence-ref-card contradiction-ref">
              {typeof ref === 'string' ? ref : ref.label || JSON.stringify(ref)}
            </div>
          ))}
        </div>
      )}

      {confidenceNote && (
        <p className="confidence-note"><em>{confidenceNote}</em></p>
      )}
    </div>
  )
}
