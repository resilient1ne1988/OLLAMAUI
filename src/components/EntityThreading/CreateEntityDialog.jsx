import React, { useState } from 'react'
import './EntityThreading.css'

const ENTITY_TYPES = [
  { value: 'person', label: 'Person' },
  { value: 'product', label: 'Product' },
  { value: 'topic', label: 'Topic' },
  { value: 'object', label: 'Object' },
  { value: 'other', label: 'Other' },
]

export default function CreateEntityDialog({ selectedText = '', workspaceId, onCreated, onClose }) {
  const [name, setName] = useState(selectedText)
  const [entityType, setEntityType] = useState('topic')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, name: name.trim(), entityType, description }),
      })
      const json = await res.json()
      if (json.ok) { onCreated(json.data) }
      else { setError(json.error || 'Failed to create entity') }
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="create-entity-overlay">
      <div className="create-entity-dialog">
        <div className="create-entity-header">
          <h3>📌 Create Entity</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="create-entity-field">
          <label>Name</label>
          <input
            className="entity-edit-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Entity name"
            autoFocus
          />
        </div>

        <div className="create-entity-field">
          <label>Type</label>
          <select
            className="entity-select"
            value={entityType}
            onChange={e => setEntityType(e.target.value)}
          >
            {ENTITY_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="create-entity-field">
          <label>Description (optional)</label>
          <textarea
            className="entity-edit-textarea"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe this entity…"
            rows={3}
          />
        </div>

        {error && <div className="entity-error">{error}</div>}

        <div className="create-entity-footer">
          <button className="btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn-primary btn-sm" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
