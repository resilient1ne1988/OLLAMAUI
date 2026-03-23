import React, { useEffect } from 'react'
import './EntityThreading.css'
import useEntityThreading from '../../hooks/useEntityThreading'
import EntityDrawer from './EntityDrawer'

export default function EntityPanel({ workspaceId, onAskFollowUp }) {
  const {
    entities, selectedEntity, drawerOpen, loading,
    loadEntities, openDrawer, closeDrawer, updateEntity, deleteEntity, togglePin,
  } = useEntityThreading(workspaceId)

  useEffect(() => { loadEntities() }, [loadEntities])

  const pinned = entities.filter(e => e.pinned)
  const unpinned = entities.filter(e => !e.pinned).sort((a, b) => a.name.localeCompare(b.name))
  const sorted = [...pinned, ...unpinned]

  return (
    <>
      <div className="entity-panel">
        <div className="entity-panel-header">
          <span>🧵 Entities <span className="entity-count">{entities.length}</span></span>
        </div>

        {loading && <div className="entity-loading">Loading…</div>}

        {!loading && entities.length === 0 && (
          <div className="entity-empty">No entities yet. Select text in a message to create one.</div>
        )}

        <div className="entity-list">
          {sorted.map(entity => (
            <div
              key={entity.id}
              className="entity-row"
              onClick={() => openDrawer(entity)}
            >
              {entity.pinned && <span className="pin-indicator">📌</span>}
              <span className="entity-name">{entity.name}</span>
              <span className={`entity-type-badge type-${entity.entityType}`}>{entity.entityType}</span>
            </div>
          ))}
        </div>
      </div>

      {drawerOpen && selectedEntity && (
        <EntityDrawer
          entity={selectedEntity}
          onClose={closeDrawer}
          onUpdate={updateEntity}
          onDelete={deleteEntity}
          onTogglePin={togglePin}
          onAskFollowUp={onAskFollowUp}
        />
      )}
    </>
  )
}
