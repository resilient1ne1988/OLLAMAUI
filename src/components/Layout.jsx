import React, { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useOllama } from '../context/OllamaContext'
import { useOpenClaw } from '../context/OpenClawContext'
import { useToolApproval } from '../context/ToolApprovalContext'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '🏠', end: true },
  { to: '/chat', label: 'Chat Studio', icon: '💬' },
  { to: '/models', label: 'Model Registry', icon: '🗂️' },
  { to: '/api-explorer', label: 'API Explorer', icon: '🔌' },
  { to: '/approvals', label: 'Approval Center', icon: '🔐', badge: true },
  { to: '/terminal', label: 'Terminal', icon: '⌨️' },
  { to: '/learn', label: 'Learn Ollama', icon: '📚' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function Layout() {
  const { models, selectedModel, setSelectedModel, connected, checkConnection } = useOllama()
  const { agents, selectedAgent, setSelectedAgent, provider, setProvider, openclawConnected, onlineMode, setOnlineMode, checkOpenClaw } = useOpenClaw()
  const { pendingCount } = useToolApproval()
  const [collapsed, setCollapsed] = useState(false)

  const isElectron = typeof window !== 'undefined' && window.navigator.userAgent.includes('Electron')
  const ollamaStatus = connected === true ? 'connected' : connected === false ? 'disconnected' : 'checking'
  const displayConnected = provider === 'ollama' ? connected : openclawConnected

  return (
    <div className="app-shell">
      {/* Top bar */}
      <header className="topbar">
        <div className="topbar-left">
          <button className="sidebar-toggle btn-ghost" onClick={() => setCollapsed(c => !c)} title="Toggle sidebar">
            {collapsed ? '▶' : '◀'}
          </button>
          <span className="app-title">₿ BTCMACHINE</span>
        </div>

        <div className="topbar-center">
          {/* Provider selector */}
          <select
            className="model-select provider-select"
            value={provider}
            onChange={e => setProvider(e.target.value)}
            style={{ minWidth: 120, maxWidth: 130 }}
          >
            <option value="ollama">🦙 Ollama</option>
            <option value="openclaw">🦅 OpenClaw</option>
          </select>

          {/* Model / Agent selector */}
          {provider === 'ollama' ? (
            <select
              className="model-select"
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              disabled={models.length === 0}
            >
              {models.length === 0
                ? <option value="">No models available</option>
                : models.map(m => <option key={m.name} value={m.name}>{m.name}</option>)
              }
            </select>
          ) : (
            <select
              className="model-select"
              value={selectedAgent}
              onChange={e => setSelectedAgent(e.target.value)}
              disabled={agents.length === 0}
            >
              {agents.length === 0
                ? <option value="">No agents available</option>
                : agents.map(a => <option key={a.id || a.name} value={a.id || a.name}>{a.name || a.id}</option>)
              }
            </select>
          )}

          <button
            className="btn-secondary btn-sm"
            onClick={provider === 'ollama' ? checkConnection : checkOpenClaw}
            title="Refresh"
          >
            ⟳
          </button>
        </div>

        <div className="topbar-right">
          {/* Online / Offline toggle */}
          <button
            className={`online-toggle ${onlineMode ? 'online-on' : 'online-off'}`}
            onClick={() => setOnlineMode(m => !m)}
            title={onlineMode ? 'Online mode — click to go offline' : 'Offline mode — click to go online'}
          >
            {onlineMode ? '🌐 Online' : '✈️ Offline'}
          </button>

          {/* Connection status */}
          <span className="status-dot">
            <span className={`dot ${displayConnected === true ? 'dot-green' : displayConnected === false ? 'dot-red' : 'dot-yellow'}`} />
            <span className="status-label">
              {displayConnected === true ? 'Connected' : displayConnected === false ? 'Disconnected' : 'Checking…'}
            </span>
          </span>
        </div>
      </header>

      <div className="content-area">
        {/* Sidebar */}
        <nav className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
          <div className="sidebar-nav">
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
              >
                <span className="nav-item-icon">{item.icon}</span>
                {!collapsed && (
                  <span className="nav-item-label">
                    {item.label}
                    {item.badge && pendingCount > 0 && (
                      <span className="nav-badge">{pendingCount}</span>
                    )}
                  </span>
                )}
                {collapsed && item.badge && pendingCount > 0 && (
                  <span className="nav-badge nav-badge-dot" />
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Main content */}
        <div className="main-content">
          <div className="page-content">
            <Outlet />
          </div>

          {/* Status bar */}
          <footer className="status-bar">
            <span className="status-bar-item">
              {provider === 'ollama' ? '🦙 Ollama' : '🦅 OpenClaw'}
              {' · '}
              {provider === 'ollama'
                ? (selectedModel || 'No model selected')
                : (selectedAgent || 'No agent selected')}
            </span>
            <span className="status-bar-sep">|</span>
            <span className={`status-bar-item ${displayConnected === true ? 'status-ok' : 'status-err'}`}>
              {displayConnected === true ? '● Connected' : displayConnected === false ? '● Disconnected' : '● Checking…'}
            </span>
            <span className="status-bar-sep">|</span>
            <span className="status-bar-item">{isElectron ? '⚡ Electron' : '🌐 Browser'}</span>
            {!onlineMode && (
              <>
                <span className="status-bar-sep">|</span>
                <span className="status-bar-item status-warn">✈️ Offline Mode</span>
              </>
            )}
          </footer>
        </div>
      </div>
    </div>
  )
}
