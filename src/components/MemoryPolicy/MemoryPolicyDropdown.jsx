import React from 'react'
import './MemoryPolicy.css'

const POLICY_OPTIONS = [
  { value: 'session', icon: '🕐', label: 'Session only' },
  { value: '24h',     icon: '⏰', label: '24 hours' },
  { value: '7d',      icon: '📅', label: '7 days' },
  { value: 'project', icon: '📁', label: 'Project' },
  { value: 'manual',  icon: '📌', label: 'Keep forever' },
]

export default function MemoryPolicyDropdown({ currentPolicy, onChange }) {
  return (
    <div className="memory-policy-dropdown">
      {POLICY_OPTIONS.map(opt => (
        <div
          key={opt.value}
          className={`memory-policy-option${currentPolicy === opt.value ? ' active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          <span>{opt.icon}</span>
          <span>{opt.label}</span>
          {currentPolicy === opt.value && <span style={{ marginLeft: 'auto' }}>✓</span>}
        </div>
      ))}
    </div>
  )
}
