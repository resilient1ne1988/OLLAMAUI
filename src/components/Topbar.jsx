import React from 'react'

export default function Topbar({ provider, selectedModel, models, selectedAgent, agents, connected, openclawConnected, onlineMode, setOnlineMode, onProviderChange, onModelChange, onAgentChange, onRefresh, onToggleSidebar, collapsed }) {
  const displayConnected = provider === 'ollama' ? connected : openclawConnected
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="sidebar-toggle btn-ghost" onClick={onToggleSidebar} title="Toggle sidebar">
          {collapsed ? '▶' : '◀'}
        </button>
        <span className="app-title">₿ BTCMACHINE</span>
      </div>
      <div className="topbar-center">
        <select className="model-select provider-select" value={provider} onChange={e => onProviderChange(e.target.value)} style={{ minWidth: 120, maxWidth: 130 }}>
          <option value="ollama">🦙 Ollama</option>
          <option value="openclaw">🦅 OpenClaw</option>
        </select>
        {provider === 'ollama' ? (
          <select className="model-select" value={selectedModel} onChange={e => onModelChange(e.target.value)} disabled={models.length === 0}>
            {models.length === 0 ? <option value="">No models available</option> : models.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
          </select>
        ) : (
          <select className="model-select" value={selectedAgent} onChange={e => onAgentChange(e.target.value)} disabled={agents.length === 0}>
            {agents.length === 0 ? <option value="">No agents available</option> : agents.map(a => <option key={a.id || a.name} value={a.id || a.name}>{a.name || a.id}</option>)}
          </select>
        )}
        <button className="btn-secondary btn-sm" onClick={onRefresh} title="Refresh">⟳</button>
      </div>
      <div className="topbar-right">
        <button className={`online-toggle ${onlineMode ? 'online-on' : 'online-off'}`} onClick={() => setOnlineMode(m => !m)} title={onlineMode ? 'Online mode' : 'Offline mode'}>
          {onlineMode ? '🌐 Online' : '✈️ Offline'}
        </button>
        <span className="status-dot">
          <span className={`dot ${displayConnected === true ? 'dot-green' : displayConnected === false ? 'dot-red' : 'dot-yellow'}`} />
          <span className="status-label">{displayConnected === true ? 'Connected' : displayConnected === false ? 'Disconnected' : 'Checking…'}</span>
        </span>
      </div>
    </header>
  )
}
