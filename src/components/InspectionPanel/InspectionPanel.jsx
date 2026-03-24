import React from 'react'
import ClaimLedger from '../ClaimLedger/ClaimLedger'
import ConflictPanel from '../ConflictCenter/ConflictPanel'
import EntityPanel from '../EntityThreading/EntityPanel'
import './InspectionPanel.css'

const TABS = [
  { id: 'claims',    label: '🔍 Claims' },
  { id: 'conflicts', label: '⚡ Conflicts' },
  { id: 'entities',  label: '🧵 Entities' },
  { id: 'memory',    label: '🗂 Memory' },
]

export default function InspectionPanel({ activeTab, onTabChange, messageId, workspaceId, onAskFollowUp }) {
  return (
    <div className="inspection-panel">
      <div className="inspection-tab-bar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`inspection-tab-btn${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="inspection-tab-content">
        {activeTab === 'claims' && (
          <ClaimLedger
            messageId={messageId}
          />
        )}
        {activeTab === 'conflicts' && (
          <ConflictPanel
            workspaceId={workspaceId}
            messageId={messageId}
          />
        )}
        {activeTab === 'entities' && (
          <EntityPanel
            workspaceId={workspaceId}
            onAskFollowUp={onAskFollowUp}
          />
        )}
        {activeTab === 'memory' && (
          <div className="inspection-memory-msg">
            <h3>🗂 Memory</h3>
            <p>Manage retention policies in Settings → Memory.</p>
          </div>
        )}
      </div>
    </div>
  )
}
