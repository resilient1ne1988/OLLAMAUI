import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOllama } from '../context/OllamaContext'

function formatSize(bytes) {
  if (!bytes) return '?'
  const gb = bytes / 1024 / 1024 / 1024
  if (gb >= 1) return gb.toFixed(1) + ' GB'
  const mb = bytes / 1024 / 1024
  return mb.toFixed(0) + ' MB'
}

function formatDate(dateStr) {
  if (!dateStr) return '?'
  try { return new Date(dateStr).toLocaleDateString() }
  catch { return dateStr }
}

function timeAgo(ts) {
  const diff = Date.now() - ts
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago'
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago'
  return Math.floor(diff / 86400000) + 'd ago'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { models, connected, checkConnection } = useOllama()
  const [ollamaVersion, setOllamaVersion] = useState(null)
  const [runningModels, setRunningModels] = useState([])
  const [recentCmds, setRecentCmds] = useState([])
  const [appInfo, setAppInfo] = useState(null)
  const [modelDetails, setModelDetails] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  useEffect(() => {
    fetch('/api/ollama-version').then(r => r.ok ? r.json() : null).then(d => d && setOllamaVersion(d.version)).catch(() => {})
    fetch('/api/ps').then(r => r.ok ? r.json() : null).then(d => d && setRunningModels(d.models || [])).catch(() => {})
    fetch('/api/shell-history').then(r => r.ok ? r.json() : null).then(d => Array.isArray(d) && setRecentCmds(d.slice(0, 5))).catch(() => {})
    fetch('/api/app-info').then(r => r.ok ? r.json() : null).then(d => d && setAppInfo(d)).catch(() => {})
  }, [])

  const showModelDetails = async (modelName) => {
    setDetailsLoading(true)
    setShowDetailsModal(true)
    try {
      const res = await fetch('/api/show', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: modelName }) })
      const data = await res.json()
      setModelDetails({ name: modelName, ...data })
    } catch { setModelDetails({ name: modelName, error: 'Failed to load details' }) }
    setDetailsLoading(false)
  }

  return (
    <div className="page dashboard-page">
      <div className="page-header">
        <h1 className="page-title">🏠 Dashboard</h1>
        <div className="page-actions">
          <button className="btn-secondary btn-sm" onClick={() => { checkConnection(); fetch('/api/ps').then(r=>r.json()).then(d=>setRunningModels(d.models||[])).catch(()=>{}) }}>⟳ Refresh</button>
        </div>
      </div>

      {/* Status cards */}
      <div className="stats-row">
        <div className={`stat-card ${connected === true ? 'stat-success' : connected === false ? 'stat-error' : 'stat-warning'}`}>
          <div className="stat-icon">{connected === true ? '🟢' : connected === false ? '🔴' : '🟡'}</div>
          <div className="stat-body">
            <div className="stat-label">Ollama</div>
            <div className="stat-value">{connected === true ? 'Connected' : connected === false ? 'Offline' : 'Checking…'}</div>
            {ollamaVersion && <div className="stat-sub">v{ollamaVersion}</div>}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🗂️</div>
          <div className="stat-body">
            <div className="stat-label">Models Installed</div>
            <div className="stat-value">{models.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-body">
            <div className="stat-label">Running</div>
            <div className="stat-value">{runningModels.length}</div>
          </div>
        </div>
        {appInfo && (
          <div className="stat-card">
            <div className="stat-icon">🖥️</div>
            <div className="stat-body">
              <div className="stat-label">App</div>
              <div className="stat-value">BTCMACHINE v{appInfo.version}</div>
              <div className="stat-sub">{Math.floor(appInfo.uptime / 60)}m uptime</div>
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="section">
        <h2 className="section-title">Quick Actions</h2>
        <div className="quick-actions">
          <button className="quick-action-btn" onClick={() => navigate('/chat')}>
            <span className="qa-icon">💬</span>
            <span className="qa-label">New Chat</span>
          </button>
          <button className="quick-action-btn" onClick={() => navigate('/models')}>
            <span className="qa-icon">🔽</span>
            <span className="qa-label">Pull a Model</span>
          </button>
          <button className="quick-action-btn" onClick={() => navigate('/api-explorer')}>
            <span className="qa-icon">🔌</span>
            <span className="qa-label">API Explorer</span>
          </button>
          <button className="quick-action-btn" onClick={() => navigate('/terminal')}>
            <span className="qa-icon">⌨️</span>
            <span className="qa-label">Terminal</span>
          </button>
          <button className="quick-action-btn" onClick={() => navigate('/learn')}>
            <span className="qa-icon">📚</span>
            <span className="qa-label">Learn Ollama</span>
          </button>
          <button className="quick-action-btn" onClick={() => navigate('/settings')}>
            <span className="qa-icon">⚙️</span>
            <span className="qa-label">Settings</span>
          </button>
        </div>
      </div>

      {/* Models grid */}
      {models.length > 0 && (
        <div className="section">
          <h2 className="section-title">Installed Models</h2>
          <div className="models-grid">
            {models.map(m => (
              <div key={m.name} className="model-card">
                <div className="model-card-header">
                  <span className="model-name">{m.name}</span>
                  {runningModels.find(r => r.name === m.name) && (
                    <span className="badge badge-green">Running</span>
                  )}
                </div>
                <div className="model-card-meta">
                  {m.size && <span className="model-size">{formatSize(m.size)}</span>}
                  {m.modified_at && <span className="model-date">{formatDate(m.modified_at)}</span>}
                  {m.details?.family && <span className="badge badge-blue">{m.details.family}</span>}
                  {m.details?.quantization_level && <span className="badge badge-gray">{m.details.quantization_level}</span>}
                </div>
                <div className="model-card-actions">
                  <button className="btn-primary btn-sm" onClick={() => navigate('/chat')}>💬 Chat</button>
                  <button className="btn-secondary btn-sm" onClick={() => showModelDetails(m.name)}>🔍 Details</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Running models */}
      {runningModels.length > 0 && (
        <div className="section">
          <h2 className="section-title">⚡ Currently Running</h2>
          <div className="running-models">
            {runningModels.map(m => (
              <div key={m.name} className="running-model-row">
                <span className="dot dot-green pulse" />
                <span className="running-model-name">{m.name}</span>
                {m.size && <span className="running-model-meta">{formatSize(m.size)}</span>}
                {m.expires_at && <span className="running-model-meta">Expires: {formatDate(m.expires_at)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent shell activity */}
      {recentCmds.length > 0 && (
        <div className="section">
          <h2 className="section-title">🖥️ Recent Shell Activity</h2>
          <div className="recent-cmds">
            {recentCmds.map((cmd, i) => (
              <div key={i} className="recent-cmd-row">
                <span className={`exit-badge ${cmd.exitCode === 0 ? 'exit-ok' : 'exit-err'}`}>{cmd.exitCode}</span>
                <code className="recent-cmd-text">{cmd.command}</code>
                <span className="recent-cmd-time">{timeAgo(cmd.timestamp)}</span>
                <button className="btn-ghost btn-xs" onClick={() => navigate('/terminal')}>→</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Getting started */}
      {models.length < 3 && (
        <div className="section">
          <h2 className="section-title">🚀 Getting Started with Ollama</h2>
          <div className="getting-started-grid">
            <div className="gs-card">
              <div className="gs-step">1</div>
              <div className="gs-title">Pull a model</div>
              <div className="gs-desc">Download a model like <code>llama3.2</code> or <code>qwen2.5</code> to get started.</div>
              <button className="btn-primary btn-sm" onClick={() => navigate('/models')}>Open Model Registry →</button>
            </div>
            <div className="gs-card">
              <div className="gs-step">2</div>
              <div className="gs-title">Start chatting</div>
              <div className="gs-desc">Use the Chat Studio to have a conversation with any installed model.</div>
              <button className="btn-primary btn-sm" onClick={() => navigate('/chat')}>Open Chat Studio →</button>
            </div>
            <div className="gs-card">
              <div className="gs-step">3</div>
              <div className="gs-title">Explore the API</div>
              <div className="gs-desc">Try every Ollama endpoint visually — no code required.</div>
              <button className="btn-primary btn-sm" onClick={() => navigate('/api-explorer')}>Open API Explorer →</button>
            </div>
          </div>
        </div>
      )}

      {/* Model details modal */}
      {showDetailsModal && (
        <div className="modal-backdrop" onClick={() => setShowDetailsModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modelDetails?.name || 'Model Details'}</h3>
              <button className="btn-ghost" onClick={() => setShowDetailsModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {detailsLoading ? (
                <div className="loading-spinner">Loading…</div>
              ) : modelDetails ? (
                <div className="model-details">
                  {modelDetails.details && (
                    <div className="details-grid">
                      {Object.entries(modelDetails.details).map(([k, v]) => (
                        <div key={k} className="detail-row">
                          <span className="detail-key">{k}</span>
                          <span className="detail-val">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {modelDetails.template && (
                    <div className="detail-section">
                      <div className="detail-section-label">Template</div>
                      <pre className="code-block">{modelDetails.template}</pre>
                    </div>
                  )}
                  {modelDetails.system && (
                    <div className="detail-section">
                      <div className="detail-section-label">System Prompt</div>
                      <pre className="code-block">{modelDetails.system}</pre>
                    </div>
                  )}
                  <div className="detail-section">
                    <div className="detail-section-label">Raw JSON</div>
                    <pre className="code-block" style={{maxHeight:'200px',overflowY:'auto'}}>{JSON.stringify(modelDetails, null, 2)}</pre>
                  </div>
                  <div className="modal-footer">
                    <button className="btn-secondary btn-sm" onClick={() => { navigator.clipboard.writeText(JSON.stringify(modelDetails, null, 2)) }}>📋 Copy JSON</button>
                    <button className="btn-primary btn-sm" onClick={() => { setShowDetailsModal(false); navigate('/chat') }}>💬 Chat with this model</button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
