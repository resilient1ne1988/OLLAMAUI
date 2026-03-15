import React from 'react'

const PAGE_NAMES = {
  dashboard: '🏠 Dashboard',
  chat: '💬 Chat Studio',
  models: '📦 Model Registry',
  'api-explorer': '🔌 API Explorer',
  terminal: '⌨️ Terminal',
  settings: '⚙️ Settings',
  learn: '📚 Learn Ollama',
}

export default function Topbar({ page, provider, setProvider, selectedModel, setSelectedModel, ollamaModels, openclawAgents, online, setOnline, ollamaConnected, openclawConnected, onRefreshModels }) {
  const options = provider === 'ollama'
    ? ollamaModels.map(m => ({ value: m.name, label: m.name.replace(/:latest$/, '') }))
    : openclawAgents.map(a => ({ value: a.id, label: a.name }))

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="breadcrumb">{PAGE_NAMES[page] || page}</span>
      </div>
      <div className="topbar-center">
        <div className="provider-toggle">
          <button
            className={`btn-sm ${provider === 'ollama' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setProvider('ollama')}
          >🦙 Ollama</button>
          <button
            className={`btn-sm ${provider === 'openclaw' ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setProvider('openclaw')}
          >🦅 OpenClaw</button>
        </div>
        <select
          className="model-select"
          value={selectedModel}
          onChange={e => setSelectedModel(e.target.value)}
        >
          <option value="">— select model —</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button className="btn-icon" onClick={onRefreshModels} title="Refresh models">🔄</button>
      </div>
      <div className="topbar-right">
        <button
          className={`btn-sm ${online ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setOnline(!online)}
          title={online ? 'Online mode' : 'Offline mode'}
        >
          {online ? '🌐 Online' : '✈️ Offline'}
        </button>
        <span className={`status-indicator ${ollamaConnected ? 'connected' : 'disconnected'}`} title="Ollama">🦙</span>
        <span className={`status-indicator ${openclawConnected ? 'connected' : 'disconnected'}`} title="OpenClaw">🦅</span>
      </div>
    </header>
  )
}
