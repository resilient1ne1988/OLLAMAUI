import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useOllama } from '../context/OllamaContext'
import { useOpenClaw } from '../context/OpenClawContext'
import { useToolApproval } from '../context/ToolApprovalContext'
import { useMcpEvents } from '../hooks/useMcpEvents'
import Topbar from './Topbar'
import Sidebar from './Sidebar'
import StatusBar from './StatusBar'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '🏠', end: true },
  { to: '/chat', label: 'Chat Studio', icon: '💬' },
  { to: '/models', label: 'Model Registry', icon: '🗂️' },
  { to: '/api-explorer', label: 'API Explorer', icon: '🔌' },
  { to: '/approvals', label: 'Approval Center', icon: '🔐', badge: true },
  { to: '/terminal', label: 'Terminal', icon: '⌨️' },
  { to: '/signals', label: 'Signal Watcher', icon: '📡' },
  { to: '/arena', label: 'Model Arena', icon: '⚔️' },
  { to: '/prompts', label: 'Prompt Arsenal', icon: '⚡' },
  { to: '/intelligence', label: 'Intelligence', icon: '🧠' },
  { to: '/workflows', label: 'Workflows', icon: '🔗' },
  { to: '/learn', label: 'Learn Ollama', icon: '📚' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function Layout() {
  const { models, selectedModel, setSelectedModel, connected, checkConnection } = useOllama()
  const { agents, selectedAgent, setSelectedAgent, provider, setProvider, openclawConnected, onlineMode, setOnlineMode, checkOpenClaw } = useOpenClaw()
  const { pendingCount } = useToolApproval()
  const { mcpCrashed, dismissCrash } = useMcpEvents()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="app-shell">
      <Topbar
        provider={provider} selectedModel={selectedModel} models={models}
        selectedAgent={selectedAgent} agents={agents}
        connected={connected} openclawConnected={openclawConnected}
        onlineMode={onlineMode} setOnlineMode={setOnlineMode}
        onProviderChange={setProvider} onModelChange={setSelectedModel} onAgentChange={setSelectedAgent}
        onRefresh={provider === 'ollama' ? checkConnection : checkOpenClaw}
        onToggleSidebar={() => setCollapsed(c => !c)} collapsed={collapsed}
      />

      {mcpCrashed && (
        <div className="mcp-crash-banner">
          ⚠️ MCP server crashed unexpectedly.{' '}
          <a href="#/settings" className="mcp-crash-link">Check Settings →</a>
          <button className="btn-ghost btn-xs" onClick={dismissCrash}>✕</button>
        </div>
      )}

      <div className="content-area">
        <Sidebar navItems={NAV_ITEMS} collapsed={collapsed} pendingCount={pendingCount} />
        <div className="main-content">
          <div className="page-content"><Outlet /></div>
          <StatusBar
            provider={provider} selectedModel={selectedModel} selectedAgent={selectedAgent}
            connected={connected} openclawConnected={openclawConnected} onlineMode={onlineMode}
          />
        </div>
      </div>
    </div>
  )
}
