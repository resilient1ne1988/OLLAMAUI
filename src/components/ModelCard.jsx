import React from 'react'
import { formatBytes, formatDate } from '../utils/format'

export default function ModelCard({ model, onChat, onInfo, onDelete }) {
  const details = model.details || {}
  const name = model.name || ''
  const displayName = name.replace(/:latest$/, '')

  return (
    <div className="model-card">
      <div className="model-card-header">
        <h4 className="model-card-name" title={name}>{displayName}</h4>
        {details.family && <span className="badge badge-blue">{details.family}</span>}
      </div>
      <div className="model-card-meta">
        {details.parameter_size && <span className="meta-item">⚡ {details.parameter_size}</span>}
        {details.quantization_level && <span className="meta-item">🗜 {details.quantization_level}</span>}
        {model.size && <span className="meta-item">💾 {formatBytes(model.size)}</span>}
        {model.modified_at && <span className="meta-item">📅 {formatDate(model.modified_at)}</span>}
      </div>
      <div className="model-card-actions">
        <button className="btn-sm btn-primary" onClick={() => onChat?.(name)}>💬 Chat</button>
        <button className="btn-sm btn-secondary" onClick={() => onInfo?.(name)}>ℹ Info</button>
        <button className="btn-sm btn-danger" onClick={() => onDelete?.(name)}>🗑 Delete</button>
      </div>
    </div>
  )
}
