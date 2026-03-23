import React, { useState, useEffect, useCallback } from 'react'
import { useMemoryPolicy, getExpiresLabel, isExpired } from '../../hooks/useMemoryPolicy'
import MemoryPolicyDropdown from './MemoryPolicyDropdown'
import './MemoryPolicy.css'

export default function WorkspaceMemorySettings({ workspaceId }) {
  const { getExpiringItems, runCleanup, setPolicy } = useMemoryPolicy()
  const [expiring, setExpiring] = useState(null)
  const [loadingExpiring, setLoadingExpiring] = useState(false)
  const [cleanupResult, setCleanupResult] = useState(null)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [defaultPolicyOpen, setDefaultPolicyOpen] = useState(false)
  const [defaultPolicy, setDefaultPolicy] = useState('manual')

  const fetchExpiring = useCallback(async () => {
    if (!workspaceId) return
    setLoadingExpiring(true)
    try {
      const data = await getExpiringItems(workspaceId, 86400000)
      setExpiring(data)
    } finally {
      setLoadingExpiring(false)
    }
  }, [workspaceId, getExpiringItems])

  useEffect(() => { fetchExpiring() }, [fetchExpiring])

  const handleCleanup = async () => {
    if (!workspaceId) return
    setCleanupLoading(true)
    setCleanupResult(null)
    try {
      const result = await runCleanup(workspaceId)
      setCleanupResult(result)
      await fetchExpiring()
    } catch (e) {
      setCleanupResult({ error: e.message })
    } finally {
      setCleanupLoading(false)
    }
  }

  const handleDefaultPolicyChange = async (policy) => {
    setDefaultPolicy(policy)
    setDefaultPolicyOpen(false)
    // Store workspace-level default policy as a special target
    if (workspaceId) {
      await setPolicy('source', `workspace-default:${workspaceId}`, policy)
    }
  }

  const expiredItems = expiring
    ? [...(expiring.sources || []), ...(expiring.claims || []), ...(expiring.entities || [])].filter(i => isExpired(i.expires_at || i.expiresAt))
    : []

  const soonItems = expiring
    ? [...(expiring.sources || []), ...(expiring.claims || []), ...(expiring.entities || [])].filter(i => !isExpired(i.expires_at || i.expiresAt))
    : []

  if (!workspaceId) {
    return (
      <div className="memory-settings">
        <p className="memory-empty">No active workspace selected.</p>
      </div>
    )
  }

  return (
    <div className="memory-settings">
      {/* Default retention policy */}
      <div className="memory-settings-section">
        <h3>🗂️ Default Retention for New Sources</h3>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button
            className="btn-secondary btn-sm"
            onClick={() => setDefaultPolicyOpen(v => !v)}
          >
            {defaultPolicy === 'session' ? '🕐 Session only'
              : defaultPolicy === '24h' ? '⏰ 24 hours'
              : defaultPolicy === '7d' ? '📅 7 days'
              : defaultPolicy === 'project' ? '📁 Project'
              : '📌 Keep forever'}
            {' ▾'}
          </button>
          {defaultPolicyOpen && (
            <MemoryPolicyDropdown
              currentPolicy={defaultPolicy}
              onChange={handleDefaultPolicyChange}
            />
          )}
        </div>
      </div>

      {/* Expiring in next 24h */}
      <div className="memory-settings-section">
        <h3>⏳ Expiring in Next 24 Hours</h3>
        {loadingExpiring ? (
          <p className="memory-empty">Loading…</p>
        ) : soonItems.length === 0 ? (
          <p className="memory-empty">No items expiring in the next 24 hours.</p>
        ) : (
          <div className="expiring-list">
            {soonItems.map((item, i) => (
              <div key={item.id || i} className="expiring-item">
                <span>{item.content ? '📝' : item.name ? '🏷️' : '📄'}</span>
                <span className="expiring-item-label">
                  {item.content || item.name || item.id || item.title || item.url || '(unnamed)'}
                </span>
                <span style={{ color: '#92400e', fontSize: '0.75rem' }}>
                  {getExpiresLabel(item.expires_at || item.expiresAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Already expired */}
      <div className="memory-settings-section">
        <h3>🗑️ Already Expired (Not Yet Cleaned)</h3>
        {loadingExpiring ? (
          <p className="memory-empty">Loading…</p>
        ) : expiredItems.length === 0 ? (
          <p className="memory-empty">No expired items awaiting cleanup.</p>
        ) : (
          <div className="expiring-list">
            {expiredItems.map((item, i) => (
              <div key={item.id || i} className="expiring-item">
                <span>🗑️</span>
                <span className="expiring-item-label">
                  {item.content || item.name || item.id || item.title || item.url || '(unnamed)'}
                </span>
                <span style={{ color: '#991b1b', fontSize: '0.75rem' }}>Expired</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Run cleanup */}
      <div className="memory-settings-section">
        <h3>🧹 Cleanup</h3>
        <button
          className="btn-secondary btn-sm"
          onClick={handleCleanup}
          disabled={cleanupLoading}
        >
          {cleanupLoading ? '⏳ Running…' : '🧹 Run Cleanup Now'}
        </button>
        {cleanupResult && !cleanupResult.error && (
          <div className="cleanup-result">
            ✅ Deleted {cleanupResult.deleted?.sources ?? 0} sources,{' '}
            {cleanupResult.deleted?.claims ?? 0} claims,{' '}
            {cleanupResult.deleted?.entities ?? 0} entities.{' '}
            {cleanupResult.orphaned > 0 && `Flagged ${cleanupResult.orphaned} orphaned entities.`}
          </div>
        )}
        {cleanupResult?.error && (
          <div className="cleanup-result" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#ef4444' }}>
            ❌ {cleanupResult.error}
          </div>
        )}
      </div>
    </div>
  )
}
