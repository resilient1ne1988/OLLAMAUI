import React, { useState } from 'react'
import SupportBadge from './SupportBadge'
import EvidenceDrawer from './EvidenceDrawer'

// Priority order for determining the card's left-border class
const TYPE_PRIORITY = ['contradicted', 'unsupported', 'text_supported', 'image_supported', 'audio_supported', 'tool_derived', 'inferred']

function getPrimaryClass(supportTypes = []) {
  for (const t of TYPE_PRIORITY) {
    if (supportTypes.includes(t)) {
      if (t === 'text_supported' || t === 'image_supported' || t === 'audio_supported' || t === 'tool_derived') {
        return 'supported'
      }
      return t // 'contradicted' | 'unsupported' | 'inferred'
    }
  }
  return 'inferred'
}

export default function ClaimCard({ claim, onRegenerate, regenerating }) {
  const [expanded, setExpanded] = useState(false)

  const borderClass = getPrimaryClass(claim.supportTypes)
  const uniqueTypes = [...new Set(claim.supportTypes)]

  return (
    <div className={`claim-card ${borderClass}`}>
      <div className="claim-card-header" onClick={() => setExpanded(e => !e)}>
        <div className="claim-text">{claim.text}</div>
        <span className="claim-chevron">{expanded ? '▲' : '▼'}</span>
      </div>

      <div className="badge-row">
        {uniqueTypes.map(t => (
          <SupportBadge key={t} type={t} />
        ))}
      </div>

      {expanded && <EvidenceDrawer claim={claim} />}

      {claim.regenerateEligible && (
        <button
          className="btn-regen"
          onClick={e => { e.stopPropagation(); onRegenerate && onRegenerate(claim.id) }}
          title="Re-generate this claim"
          disabled={regenerating}
        >
          {regenerating ? '⏳ Regenerating…' : '↻ Regenerate'}
        </button>
      )}
    </div>
  )
}
