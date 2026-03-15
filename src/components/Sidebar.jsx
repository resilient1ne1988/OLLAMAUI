import React from 'react'

const NAV_ITEMS = [
  { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
  { id: 'chat', icon: '💬', label: 'Chat Studio' },
  { id: 'models', icon: '📦', label: 'Models' },
  { id: 'api-explorer', icon: '🔌', label: 'API Explorer' },
  { id: 'terminal', icon: '⌨️', label: 'Terminal' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
  { id: 'learn', icon: '📚', label: 'Learn' },
]

export default function Sidebar({ page, setPage, collapsed, setCollapsed }) {
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <span className="brand-icon">🤖</span>
        {!collapsed && <span className="brand-name">BTCMACHINE</span>}
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`nav-item ${page === item.id ? 'active' : ''}`}
            onClick={() => setPage(item.id)}
            title={collapsed ? item.label : ''}
          >
            <span className="nav-icon">{item.icon}</span>
            {!collapsed && <span className="nav-label">{item.label}</span>}
          </button>
        ))}
      </nav>
      <button className="sidebar-collapse-btn" onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? '→' : '←'}
      </button>
    </aside>
  )
}
