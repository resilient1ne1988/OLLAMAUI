import React, { useState } from 'react'
import './EntityThreading.css'

export default function EntityDrawer({ entity, onClose, onUpdate, onDelete, onTogglePin, onAskFollowUp }) {
  const [editingDesc, setEditingDesc] = useState(false)
  const [desc, setDesc] = useState(entity.description || '')
  const [editingAliases, setEditingAliases] = useState(false)
  const [aliasText, setAliasText] = useState((entity.aliases || []).join(', '))

  const saveDesc = () => {
    setEditingDesc(false)
    onUpdate(entity.id, { description: desc })
  }

  const saveAliases = () => {
    setEditingAliases(false)
    const aliases = aliasText.split(',').map(a => a.trim()).filter(Boolean)
    onUpdate(entity.id, { aliases })
  }

  return (
    <>
      <div className="entity-drawer-overlay" onClick={onClose} />
      <div className="entity-drawer">
        <div className="entity-drawer-header">
          <div className="entity-drawer-title">
            <span>{entity.name}</span>
            <span className={`entity-type-badge type-${entity.entityType}`}>{entity.entityType}</span>
          </div>
          <div className="entity-drawer-actions">
            <button
              className="btn-icon"
              title={entity.pinned ? 'Unpin' : 'Pin'}
              onClick={() => onTogglePin(entity.id)}
            >
              <span className={entity.pinned ? 'pin-indicator' : ''}>📌</span>
            </button>
            <button className="btn-icon" onClick={onClose} title="Close">✕</button>
          </div>
        </div>

        <div className="entity-drawer-section">
          <div className="entity-section-label">Description</div>
          {editingDesc ? (
            <textarea
              className="entity-edit-textarea"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              onBlur={saveDesc}
              autoFocus
            />
          ) : (
            <div
              className="entity-desc"
              onClick={() => setEditingDesc(true)}
              title="Click to edit"
            >
              {desc || <span className="entity-placeholder">Click to add description…</span>}
            </div>
          )}
        </div>

        <div className="entity-drawer-section">
          <div className="entity-section-label">Aliases</div>
          {editingAliases ? (
            <input
              className="entity-edit-input"
              value={aliasText}
              onChange={e => setAliasText(e.target.value)}
              onBlur={saveAliases}
              autoFocus
              placeholder="Comma-separated aliases"
            />
          ) : (
            <div className="entity-aliases" onClick={() => setEditingAliases(true)} title="Click to edit">
              {(entity.aliases || []).length === 0
                ? <span className="entity-placeholder">Click to add aliases…</span>
                : entity.aliases.map((a, i) => <span key={i} className="alias-chip">{a}</span>)
              }
            </div>
          )}
        </div>

        {(entity.claimRefs || []).length > 0 && (
          <div className="entity-drawer-section">
            <div className="entity-section-label">Related Claims</div>
            <ul className="entity-ref-list">
              {entity.claimRefs.map((c, i) => (
                <li key={i} className="entity-ref-item">{c}</li>
              ))}
            </ul>
          </div>
        )}

        {(entity.sourceRefs || []).length > 0 && (
          <div className="entity-drawer-section">
            <div className="entity-section-label">Related Sources</div>
            <ul className="entity-ref-list">
              {entity.sourceRefs.map((s, i) => (
                <li key={i} className="entity-ref-item">{s}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="entity-drawer-footer">
          <button
            className="btn-secondary btn-sm"
            onClick={() => onAskFollowUp && onAskFollowUp(`Tell me more about ${entity.name}`)}
          >
            💬 Ask Follow-up
          </button>
          <button
            className="btn-danger btn-sm"
            onClick={() => { if (confirm(`Delete entity "${entity.name}"?`)) onDelete(entity.id) }}
          >
            🗑 Delete
          </button>
        </div>
      </div>
    </>
  )
}
