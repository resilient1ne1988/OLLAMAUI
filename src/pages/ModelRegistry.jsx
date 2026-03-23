import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOllama } from '../context/OllamaContext'
import { formatSize, timeAgo } from '../utils/format'

const SUGGESTED_MODELS = [
  { name: 'llama3.2', size: '~2GB', desc: 'Meta\'s Llama 3.2 — great all-rounder', tag: 'Popular' },
  { name: 'llama3.2:1b', size: '~0.8GB', desc: 'Tiny Llama — fast, low VRAM', tag: 'Tiny' },
  { name: 'llama3.2:3b', size: '~2GB', desc: 'Small Llama — good balance', tag: 'Small' },
  { name: 'qwen2.5:0.5b', size: '~0.4GB', desc: 'Qwen 2.5 tiny — ultra fast', tag: 'Tiny' },
  { name: 'qwen2.5:7b', size: '~4.7GB', desc: 'Qwen 2.5 7B — very capable', tag: 'Large' },
  { name: 'mistral', size: '~4GB', desc: 'Mistral 7B — coding & reasoning', tag: 'Popular' },
  { name: 'phi3', size: '~2.3GB', desc: 'Microsoft Phi-3 mini — efficient', tag: 'Efficient' },
  { name: 'gemma2:2b', size: '~1.6GB', desc: 'Google Gemma2 2B — fast', tag: 'Google' },
  { name: 'nomic-embed-text', size: '~274MB', desc: 'Embedding model for text', tag: 'Embedding' },
]

export default function ModelRegistry() {
  const navigate = useNavigate()
  const { models, checkConnection } = useOllama()
  const [runningModels, setRunningModels] = useState([])
  const [pullName, setPullName] = useState('')
  const [pulling, setPulling] = useState(false)
  const [pullProgress, setPullProgress] = useState([])
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showDetails, setShowDetails] = useState(null)
  const [detailsData, setDetailsData] = useState(null)
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'table'
  const [filter, setFilter] = useState('')
  const [toast, setToast] = useState(null)

  const showToast = (msg, type='info') => {
    setToast({msg, type})
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    fetch('/api/ps').then(r => r.json()).then(d => setRunningModels(d.models || [])).catch(() => {})
  }, [])

  const pullModel = async () => {
    const name = pullName.trim()
    if (!name) return
    setPulling(true)
    setPullProgress([{ status: `Starting pull: ${name}…` }])
    try {
      const res = await fetch('/api/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, stream: true })
      })
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop()
        for (const line of lines) {
          const t = line.trim()
          if (!t) continue
          try {
            const j = JSON.parse(t)
            setPullProgress(prev => {
              const last = prev[prev.length - 1]
              if (last && last.status === j.status && j.completed) {
                return [...prev.slice(0, -1), j]
              }
              return [...prev, j]
            })
          } catch {}
        }
      }
      showToast(`✅ Pulled ${name} successfully`, 'success')
      checkConnection()
      setPullName('')
    } catch (e) {
      showToast(`❌ Pull failed: ${e.message}`, 'error')
    }
    setPulling(false)
  }

  const deleteModel = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: deleteTarget })
      })
      showToast(`🗑️ Deleted ${deleteTarget}`, 'success')
      checkConnection()
    } catch (e) {
      showToast(`❌ Delete failed: ${e.message}`, 'error')
    }
    setDeleteTarget(null)
    setDeleting(false)
  }

  const loadDetails = async (name) => {
    setShowDetails(name)
    setDetailsData(null)
    try {
      const res = await fetch('/api/show', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })
      setDetailsData(await res.json())
    } catch { setDetailsData({ error: 'Failed to load' }) }
  }

  const filteredModels = models.filter(m => m.name.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div className="page models-page">
      <div className="page-header">
        <h1 className="page-title">🗂️ Model Registry</h1>
        <div className="page-actions">
          <button className={`btn-ghost btn-sm ${viewMode==='grid'?'btn-active':''}`} onClick={() => setViewMode('grid')}>⊞ Grid</button>
          <button className={`btn-ghost btn-sm ${viewMode==='table'?'btn-active':''}`} onClick={() => setViewMode('table')}>≡ Table</button>
          <button className="btn-secondary btn-sm" onClick={() => { checkConnection(); fetch('/api/ps').then(r=>r.json()).then(d=>setRunningModels(d.models||[])).catch(()=>{}) }}>⟳ Refresh</button>
        </div>
      </div>

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      {/* Pull model */}
      <div className="section pull-section">
        <h2 className="section-title">🔽 Pull a Model</h2>
        <div className="pull-form">
          <input
            className="text-input"
            value={pullName}
            onChange={e => setPullName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !pulling && pullModel()}
            placeholder="Model name, e.g. llama3.2 or mistral:7b"
            disabled={pulling}
          />
          <button className="btn-primary" onClick={pullModel} disabled={!pullName.trim() || pulling}>
            {pulling ? '⏳ Pulling…' : '🔽 Pull'}
          </button>
        </div>
        {pullProgress.length > 0 && (
          <div className="pull-progress">
            {pullProgress.slice(-8).map((p, i) => (
              <div key={i} className="pull-progress-line">
                <span className="pull-status">{p.status}</span>
                {p.completed !== undefined && p.total !== undefined && p.total > 0 && (
                  <div className="progress-bar-wrap">
                    <div className="progress-bar" style={{ width: `${Math.round(p.completed / p.total * 100)}%` }} />
                    <span className="progress-pct">{Math.round(p.completed / p.total * 100)}%</span>
                  </div>
                )}
                {p.digest && <span className="pull-digest">{p.digest.slice(0, 20)}…</span>}
              </div>
            ))}
          </div>
        )}

        {/* Suggested models */}
        <div className="suggested-models">
          <div className="suggested-label">Popular models to try:</div>
          <div className="suggested-chips">
            {SUGGESTED_MODELS.filter(s => !models.find(m => m.name === s.name)).map(s => (
              <button key={s.name} className="suggested-chip" title={s.desc} onClick={() => setPullName(s.name)}>
                <span className="chip-name">{s.name}</span>
                <span className="chip-size">{s.size}</span>
                <span className={`badge badge-${s.tag === 'Popular' ? 'green' : s.tag === 'Tiny' ? 'blue' : 'gray'}`}>{s.tag}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Installed models */}
      <div className="section">
        <h2 className="section-title">📦 Installed Models ({filteredModels.length})</h2>
        <input
          className="text-input search-input"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search models…"
        />

        {filteredModels.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <div className="empty-title">No models installed</div>
            <div className="empty-sub">Pull a model above to get started.</div>
          </div>
        )}

        {viewMode === 'grid' ? (
          <div className="models-grid">
            {filteredModels.map(m => (
              <div key={m.name} className="model-card">
                <div className="model-card-header">
                  <span className="model-name">{m.name}</span>
                  {runningModels.find(r => r.name === m.name) && <span className="badge badge-green">Running</span>}
                </div>
                <div className="model-card-meta">
                  {m.size && <span>{formatSize(m.size)}</span>}
                  {m.details?.family && <span className="badge badge-blue">{m.details.family}</span>}
                  {m.details?.quantization_level && <span className="badge badge-gray">{m.details.quantization_level}</span>}
                </div>
                <div className="model-card-actions">
                  <button className="btn-primary btn-sm" onClick={() => navigate('/chat')}>💬 Chat</button>
                  <button className="btn-secondary btn-sm" onClick={() => loadDetails(m.name)}>🔍 Info</button>
                  <button className="btn-danger btn-sm" onClick={() => setDeleteTarget(m.name)}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Size</th><th>Family</th><th>Quant</th><th>Modified</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filteredModels.map(m => (
                <tr key={m.name}>
                  <td><code>{m.name}</code></td>
                  <td>{formatSize(m.size)}</td>
                  <td>{m.details?.family || '—'}</td>
                  <td>{m.details?.quantization_level || '—'}</td>
                  <td>{m.modified_at ? new Date(m.modified_at).toLocaleDateString() : '—'}</td>
                  <td>{runningModels.find(r => r.name === m.name) ? <span className="badge badge-green">Running</span> : <span className="badge badge-gray">Idle</span>}</td>
                  <td>
                    <button className="btn-primary btn-xs" onClick={() => navigate('/chat')}>Chat</button>
                    <button className="btn-secondary btn-xs" onClick={() => loadDetails(m.name)}>Info</button>
                    <button className="btn-danger btn-xs" onClick={() => setDeleteTarget(m.name)}>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Running models */}
      {runningModels.length > 0 && (
        <div className="section">
          <h2 className="section-title">⚡ Running Models</h2>
          <div className="running-models">
            {runningModels.map(m => (
              <div key={m.name} className="running-model-row">
                <span className="dot dot-green pulse" />
                <span className="running-model-name">{m.name}</span>
                {m.size && <span className="running-model-meta">{formatSize(m.size)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3>⚠️ Delete Model</h3>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{deleteTarget}</strong>? This cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn-danger" onClick={deleteModel} disabled={deleting}>
                {deleting ? 'Deleting…' : '🗑️ Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details modal */}
      {showDetails && (
        <div className="modal-backdrop" onClick={() => { setShowDetails(null); setDetailsData(null) }}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔍 {showDetails}</h3>
              <button className="btn-ghost" onClick={() => { setShowDetails(null); setDetailsData(null) }}>✕</button>
            </div>
            <div className="modal-body">
              {!detailsData ? (
                <div className="loading-spinner">Loading…</div>
              ) : (
                <div>
                  {detailsData.details && (
                    <div className="details-grid">
                      {Object.entries(detailsData.details).map(([k,v]) => (
                        <div key={k} className="detail-row">
                          <span className="detail-key">{k}</span>
                          <span className="detail-val">{Array.isArray(v) ? v.join(', ') : String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <pre className="code-block" style={{maxHeight:'300px',overflowY:'auto',marginTop:'12px'}}>{JSON.stringify(detailsData, null, 2)}</pre>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary btn-sm" onClick={() => navigator.clipboard.writeText(JSON.stringify(detailsData,null,2))}>📋 Copy JSON</button>
              <button className="btn-primary btn-sm" onClick={() => { setShowDetails(null); navigate('/chat') }}>💬 Chat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
