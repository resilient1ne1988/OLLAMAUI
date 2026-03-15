import React, { useState } from 'react'
import { useToolApproval } from '../context/ToolApprovalContext'

const POLICY_LABELS = {
  approval: { icon: '🔐', label: 'Require Approval', color: 'policy-approval' },
  session:  { icon: '🔓', label: 'Allow for Session', color: 'policy-session' },
  always:   { icon: '⚡',  label: 'Always Allow',     color: 'policy-always' },
  deny:     { icon: '🚫',  label: 'Always Deny',      color: 'policy-deny' },
}

function formatArgs(args) {
  try {
    return JSON.stringify(args, null, 2)
  } catch {
    return String(args)
  }
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function CallCard({ call, onApprove, onReject, isSessionPolicy }) {
  const isPending = call.status === 'pending'
  const isRunning = call.status === 'running'
  const isApproved = call.status === 'approved'
  const isRejected = call.status === 'rejected'

  return (
    <div className={`approval-card ${
      isPending || isRunning ? 'approval-pending'
      : isApproved ? 'approval-approved'
      : 'approval-rejected'
    }`}>
      <div className="approval-card-header">
        <div className="approval-card-left">
          <span className="approval-tool-name">
            {isPending && '⏳ '}
            {isRunning && '⚙️ '}
            {isApproved && (call.sessionAuto ? '🔓 ' : '✅ ')}
            {isRejected && '🚫 '}
            <code>{call.name}()</code>
          </span>
          <span className="approval-card-time">{formatTime(call.timestamp)}</span>
          {call.sessionAuto && (
            <span className="approval-session-badge">session auto</span>
          )}
        </div>
        {isPending && (
          <div className="approval-card-actions">
            <button className="btn-approve" onClick={() => onApprove(call.id)}>
              {isSessionPolicy ? '🔓 Approve & Allow Session' : '✅ Approve & Run'}
            </button>
            <button className="btn-reject" onClick={() => onReject(call.id)}>
              🚫 Reject
            </button>
          </div>
        )}
        {isRunning && (
          <span className="approval-running-label">Running…</span>
        )}
        {isApproved && (
          <span className="approval-status-label approval-ok">
            {call.sessionAuto ? 'Auto-executed (session)' : `Executed (exit ${call.exitCode ?? '?'})`}
          </span>
        )}
        {isRejected && (
          <span className="approval-status-label approval-no">Rejected</span>
        )}
      </div>

      {/* Arguments */}
      <div className="approval-args-block">
        <div className="approval-section-label">Arguments</div>
        <pre className="approval-pre">{formatArgs(call.args)}</pre>
      </div>

      {/* Result */}
      {isApproved && call.result && (
        <div className="approval-result-block">
          <div className="approval-section-label">Output</div>
          <pre className="approval-pre approval-output">{call.result}</pre>
        </div>
      )}
    </div>
  )
}

export default function ApprovalCenter() {
  const { calls, approve, reject, clearHistory, policy, sessionAllowed, clearSessionAllowlist } = useToolApproval()
  const [filter, setFilter] = useState('all') // 'all' | 'pending' | 'history'

  const policyMeta = POLICY_LABELS[policy] || POLICY_LABELS.approval
  const isSessionPolicy = policy === 'session'

  const pending = calls.filter(c => c.status === 'pending' || c.status === 'running')
  const history = calls.filter(c => c.status === 'approved' || c.status === 'rejected')

  const displayed = filter === 'pending' ? pending
    : filter === 'history' ? history
    : [...pending, ...history].sort((a, b) => b.timestamp - a.timestamp)

  return (
    <div className="approval-center">
      <div className="approval-header">
        <div className="approval-title-row">
          <h2 className="approval-title">🔐 Tool Approval Center</h2>
          <p className="approval-subtitle">
            Ollama’s native tool calling sends structured function calls here before any command runs on your machine.
          </p>
        </div>
        <div className="approval-header-actions">
          {history.length > 0 && (
            <button className="btn-ghost btn-sm" onClick={clearHistory}>
              🗑 Clear History
            </button>
          )}
        </div>
      </div>

      {/* Policy banner */}
      <div className={`approval-policy-banner ${policyMeta.color}`}>
        <span className="approval-policy-icon">{policyMeta.icon}</span>
        <span className="approval-policy-label">
          Shell Safety: <strong>{policyMeta.label}</strong>
        </span>
        {policy === 'always' && (
          <span className="approval-policy-note">
            ⚠️ All tool calls execute automatically without user review.
          </span>
        )}
        {policy === 'deny' && (
          <span className="approval-policy-note">
            All tool calls are blocked. Change in Settings to allow execution.
          </span>
        )}
        {policy === 'session' && sessionAllowed.size > 0 && (
          <span className="approval-policy-note">
            {sessionAllowed.size} tool{sessionAllowed.size !== 1 ? 's' : ''} approved for this session.
          </span>
        )}
        <a href="#/settings" className="approval-policy-link">Change in Settings →</a>
      </div>

      {/* Session allowlist */}
      {isSessionPolicy && sessionAllowed.size > 0 && (
        <div className="approval-session-allowlist">
          <div className="approval-section-label">
            Session Allowlist
            <button className="btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={clearSessionAllowlist}>
              ❌ Clear All
            </button>
          </div>
          <div className="approval-session-chips">
            {[...sessionAllowed].map(toolName => (
              <span key={toolName} className="approval-session-chip">
                🔓 {toolName}()
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats strip */}
      <div className="approval-stats">
        <div className={`stat-chip ${pending.length > 0 ? 'stat-chip-pending' : ''}`}>
          <span className="stat-num">{pending.length}</span>
          <span className="stat-label">Pending</span>
        </div>
        <div className="stat-chip">
          <span className="stat-num">{calls.filter(c => c.status === 'approved').length}</span>
          <span className="stat-label">Approved</span>
        </div>
        <div className="stat-chip">
          <span className="stat-num">{calls.filter(c => c.status === 'rejected').length}</span>
          <span className="stat-label">Rejected</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="approval-filter-bar">
        {['all', 'pending', 'history'].map(f => (
          <button
            key={f}
            className={`approval-filter-btn ${filter === f ? 'approval-filter-active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'pending' ? `Pending (${pending.length})` : `History (${history.length})`}
          </button>
        ))}
      </div>

      {/* Call list */}
      <div className="approval-list">
        {displayed.length === 0 && (
          <div className="approval-empty">
            {filter === 'pending'
              ? '✓ No pending tool calls. Chat with the model and it will request tools here.'
              : 'No tool calls yet. When the model calls a tool, it will appear here for review.'}
          </div>
        )}
        {displayed.map(call => (
          <CallCard
            key={call.id}
            call={call}
            onApprove={approve}
            onReject={reject}
            isSessionPolicy={isSessionPolicy}
          />
        ))}
      </div>
    </div>
  )
}
