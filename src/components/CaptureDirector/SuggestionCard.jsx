import React from 'react'

const MODALITY_ICON = {
  text: '📄',
  image: '🖼️',
  audio: '🎙️',
  pdf: '📋',
  csv: '📊',
  screenshot: '🖥️',
}

const IMPACT_LABEL = { high: 'High', medium: 'Medium', low: 'Low' }

export default function SuggestionCard({ suggestion, onDismiss, onFollow }) {
  const icon = MODALITY_ICON[suggestion.recommendedModality] || '📄'
  return (
    <div className="suggestion-card">
      <span className="suggestion-modality-icon" aria-label={suggestion.recommendedModality}>{icon}</span>
      <div className="suggestion-body">
        <p className="suggestion-text">{suggestion.suggestionText}</p>
        <div className="suggestion-footer">
          <span className={`impact-badge ${suggestion.expectedImpact}`}>
            {IMPACT_LABEL[suggestion.expectedImpact] || suggestion.expectedImpact} impact
          </span>
          <div className="suggestion-actions">
            <button
              className="btn-ghost btn-sm"
              onClick={() => onDismiss(suggestion.id)}
              title="Dismiss this suggestion"
            >
              ✕ Dismiss
            </button>
            <button
              className="btn-ghost btn-sm"
              onClick={() => onFollow(suggestion)}
              title="Follow this suggestion"
            >
              ➕ Follow
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
