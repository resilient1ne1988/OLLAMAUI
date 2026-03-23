import React, { useState } from 'react'
import { useSignalFeedContext } from '../context/SignalFeedContext'
import './SignalWatcher.css'

const OPENCLAW_AGENTS = [
  { id: 'btc-chief', name: 'BTC Chief' },
  { id: 'btc-price-desk', name: 'Price Desk' },
  { id: 'btc-catalyst-desk', name: 'Catalyst Desk' },
  { id: 'btc-macro-desk', name: 'Macro Desk' },
  { id: 'btc-flow-desk', name: 'Flow Desk' },
  { id: 'btc-bookmaker-desk', name: 'Bookmaker Desk' },
  { id: 'btc-opportunity-ranker-desk', name: 'Opportunity Ranker' },
]

const INTERVALS = [
  { label: '15 minutes', value: 15 * 60 * 1000 },
  { label: '30 minutes', value: 30 * 60 * 1000 },
  { label: '1 hour', value: 60 * 60 * 1000 },
  { label: '4 hours', value: 4 * 60 * 60 * 1000 },
  { label: 'Daily (24h)', value: 24 * 60 * 60 * 1000 },
]

function getSentimentColor(content) {
  const lower = (content || '').toLowerCase()
  if (lower.includes('bullish') || /score[:\s]+[8-9]|score[:\s]+10/i.test(content)) return '#22c55e'
  if (lower.includes('bearish') || /score[:\s]+[1-3]/i.test(content)) return '#ef4444'
  return '#eab308'
}

function FeedCard({ result }) {
  const color = getSentimentColor(result.content)
  const agent = OPENCLAW_AGENTS.find(a => a.id === result.agentId)
  return (
    <div className="signal-card" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="signal-card-header">
        <span className="signal-agent">{agent?.name || result.agentId}</span>
        <span className="signal-time">{new Date(result.timestamp).toLocaleString()}</span>
      </div>
      <div className="signal-content">
        {(result.content || '').slice(0, 300)}
        {result.content?.length > 300 ? '…' : ''}
      </div>
    </div>
  )
}

const EMPTY_FORM = {
  name: '',
  agentId: 'btc-chief',
  prompt: 'Give me a BTC market brief with an opportunity score 1-10.',
  intervalMs: 30 * 60 * 1000,
  active: true,
}

export default function SignalWatcher() {
  const { schedules, results, running, saveSchedule, deleteSchedule, runNow } = useSignalFeedContext()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const setF = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    await saveSchedule(form)
    setForm(EMPTY_FORM)
    setShowForm(false)
    setSaving(false)
  }

  return (
    <div className="page signal-watcher-page">
      <div className="page-header">
        <h1 className="page-title">📡 Signal Watcher</h1>
        <div className="page-actions">
          <button className="btn-primary btn-sm" onClick={() => setShowForm(s => !s)}>
            {showForm ? '✕ Cancel' : '+ New Schedule'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="section">
          <h2 className="section-title">New Schedule</h2>
          <div className="settings-grid">
            <div className="form-field">
              <label className="form-label">Name</label>
              <input
                className="text-input"
                value={form.name}
                onChange={e => setF('name', e.target.value)}
                placeholder="e.g. Morning BTC Check"
              />
            </div>
            <div className="form-field">
              <label className="form-label">Agent</label>
              <select className="text-input" value={form.agentId} onChange={e => setF('agentId', e.target.value)}>
                {OPENCLAW_AGENTS.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Interval</label>
              <select className="text-input" value={form.intervalMs} onChange={e => setF('intervalMs', Number(e.target.value))}>
                {INTERVALS.map(i => (
                  <option key={i.value} value={i.value}>{i.label}</option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Prompt</label>
              <textarea
                className="text-input"
                rows={3}
                value={form.prompt}
                onChange={e => setF('prompt', e.target.value)}
              />
            </div>
            <div className="form-field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={e => setF('active', e.target.checked)}
                />
                <span className="form-label" style={{ margin: 0 }}>Active (auto-run on interval)</span>
              </label>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button
              className="btn-primary btn-sm"
              onClick={handleSave}
              disabled={saving || !form.name}
            >
              {saving ? '⏳ Saving…' : '💾 Save Schedule'}
            </button>
          </div>
        </div>
      )}

      <div className="signal-layout">
        <div className="signal-schedules">
          <h2 className="section-title">Schedules ({schedules.length})</h2>
          {schedules.length === 0 && (
            <div className="empty-state">No schedules yet. Create one above.</div>
          )}
          {schedules.map(s => {
            const isRunning = running.has(s.id)
            const interval = INTERVALS.find(i => i.value === s.intervalMs)
            return (
              <div key={s.id} className="schedule-card">
                <div className="schedule-header">
                  <div className="schedule-name">
                    {isRunning && <span className="pulse-dot" title="Running…" />}
                    {s.name}
                  </div>
                  <div className="schedule-actions">
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => runNow(s.id)}
                      disabled={isRunning}
                      title="Run now"
                    >
                      ▶
                    </button>
                    <button
                      className="btn-ghost btn-sm"
                      onClick={() => deleteSchedule(s.id)}
                      title="Delete"
                    >
                      🗑
                    </button>
                  </div>
                </div>
                <div className="schedule-meta">
                  <span className="badge badge-blue">
                    {OPENCLAW_AGENTS.find(a => a.id === s.agentId)?.name || s.agentId}
                  </span>
                  <span className="badge badge-gray">
                    {interval?.label || `${s.intervalMs}ms`}
                  </span>
                  <span className={`badge ${s.active ? 'badge-green' : 'badge-gray'}`}>
                    {s.active ? 'Active' : 'Paused'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="signal-feed">
          <h2 className="section-title">Live Feed ({results.length})</h2>
          {results.length === 0 && (
            <div className="empty-state">No results yet. Run a schedule to see signals here.</div>
          )}
          {results.map((r, i) => (
            <FeedCard key={r.id || i} result={r} />
          ))}
        </div>
      </div>
    </div>
  )
}
