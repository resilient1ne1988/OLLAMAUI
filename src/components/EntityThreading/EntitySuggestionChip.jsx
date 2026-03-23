import React from 'react'
import './EntityThreading.css'

export default function EntitySuggestionChip({ entity, onOpen }) {
  return (
    <span className="entity-suggestion-chip" onClick={() => onOpen(entity)} title={`View entity: ${entity.name}`}>
      📎 {entity.name}
    </span>
  )
}
