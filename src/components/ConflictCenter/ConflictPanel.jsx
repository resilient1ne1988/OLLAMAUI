import React from 'react'
import ConflictCard from './ConflictCard'
import './ConflictCenter.css'

export default function ConflictPanel({ conflicts, onResolve }) {
  return (
    <div className="conflict-panel">
      {conflicts.map(conflict => (
        <ConflictCard key={conflict.id} conflict={conflict} onResolve={onResolve} />
      ))}
    </div>
  )
}
