import React, { useRef, useState } from 'react'
import { useWorkspace } from '../../context/WorkspaceContext'
import RetentionBadge from '../MemoryPolicy/RetentionBadge'
import './WorkspacePanel.css'

const MODALITY_ICONS = {
  text: '📄',
  pdf: '📕',
  image: '🖼️',
  audio: '🔊',
  tool: '🔧',
  transcript: '📝',
  screenshot: '🖥️',
}

function modalityFromFile(file) {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type === 'application/pdf') return 'pdf'
  return 'text'
}

export default function WorkspacePanel({ onOpenEntities }) {
  const { workspaces, activeWorkspaceId, sources, loadingSources, addSource } = useWorkspace()
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [entitiesOpen, setEntitiesOpen] = useState(true)

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId)

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length || !activeWorkspaceId) return
    setUploading(true)
    try {
      for (const file of files) {
        const modality = modalityFromFile(file)
        // Read file content as text for text/pdf/transcript, skip binary for images/audio
        let content = undefined
        if (modality === 'text' || modality === 'transcript') {
          content = await file.text().catch(() => undefined)
        }
        await addSource(activeWorkspaceId, {
          name: file.name,
          modality,
          extractionStatus: 'pending',
          ...(content !== undefined ? { content } : {}),
        })
      }
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <aside className="workspace-panel">
      <div className="workspace-panel-header">
        <span className="workspace-panel-title">
          {activeWorkspace ? activeWorkspace.name : 'Workspace'}
        </span>
      </div>

      <section className="workspace-panel-section">
        <div className="workspace-panel-section-header">
          <span>📂 Sources</span>
          <button
            className="workspace-panel-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !activeWorkspaceId}
            title="Upload files"
          >
            {uploading ? '⏳' : '＋'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        <div className="workspace-panel-sources">
          {loadingSources && <div className="workspace-panel-empty">Loading…</div>}
          {!loadingSources && sources.length === 0 && (
            <div className="workspace-panel-empty">No sources yet</div>
          )}
          {sources.map(source => (
            <div key={source.id} className="workspace-panel-source-row">
              <span className="workspace-panel-source-icon">
                {MODALITY_ICONS[source.modality] || '📄'}
              </span>
              <span className="workspace-panel-source-name" title={source.name}>
                {source.name}
              </span>
              <RetentionBadge
                targetType="source"
                targetId={source.id}
                workspaceId={activeWorkspaceId}
                compact
              />
            </div>
          ))}
        </div>
      </section>

      <section className="workspace-panel-section">
        <div
          className="workspace-panel-section-header workspace-panel-collapsible"
          onClick={() => setEntitiesOpen(v => !v)}
        >
          <span>🧵 Entities</span>
          <span className="workspace-panel-chevron">{entitiesOpen ? '▾' : '▸'}</span>
        </div>
        {entitiesOpen && (
          <div className="workspace-panel-entities">
            <button
              className="workspace-panel-entities-link"
              onClick={onOpenEntities}
            >
              🧵 View Entities →
            </button>
          </div>
        )}
      </section>
    </aside>
  )
}
