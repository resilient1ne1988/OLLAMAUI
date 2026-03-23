import React from 'react'
import { NavLink } from 'react-router-dom'

export default function Sidebar({ navItems, collapsed, pendingCount }) {
  return (
    <nav className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="sidebar-nav">
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}>
            <span className="nav-item-icon">{item.icon}</span>
            {!collapsed && (
              <span className="nav-item-label">
                {item.label}
                {item.badge && pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
              </span>
            )}
            {collapsed && item.badge && pendingCount > 0 && <span className="nav-badge nav-badge-dot" />}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
