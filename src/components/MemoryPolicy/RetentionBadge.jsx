import React, { useState, useEffect, useRef } from 'react'
import { useMemoryPolicy, getExpiresLabel, isExpired } from '../../hooks/useMemoryPolicy'
import MemoryPolicyDropdown from './MemoryPolicyDropdown'
import './MemoryPolicy.css'

const POLICY_ICONS = {
  session: '🕐',
  '24h': '⏰',
  '7d': '⏰',
  project: '📁',
  manual: '📌',
}

function getBadgeClass(policy, expiresAt) {
  if (isExpired(expiresAt)) return 'expired'
  if (expiresAt) {
    const ms = new Date(expiresAt).getTime() - Date.now()
    if (ms < 7200000) return 'expiring-soon'
  }
  if (policy === 'session') return 'session'
  if (policy === 'manual') return 'manual'
  if (policy === 'project') return 'project'
  if (policy === '24h') return 'h24'
  if (policy === '7d') return 'd7'
  return ''
}

export default function RetentionBadge({ targetType, targetId, workspaceId, compact = false }) {
  const { getPolicy, setPolicy, policyFor } = useMemoryPolicy()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    if (!policyFor(targetType, targetId)) {
      getPolicy(targetType, targetId)
    }
  }, [targetType, targetId])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const policy = policyFor(targetType, targetId)
  const expiresAt = policy?.expiresAt || null
  const retentionPolicy = policy?.retentionPolicy || null

  const expired = isExpired(expiresAt)
  const expiringSoon = !expired && expiresAt && (new Date(expiresAt).getTime() - Date.now()) < 7200000
  const badgeClass = getBadgeClass(retentionPolicy, expiresAt)
  const icon = expired ? '🗑️' : expiringSoon ? '⚠️' : (POLICY_ICONS[retentionPolicy] || '📌')
  const label = expired ? 'Expired' : expiringSoon ? 'Soon' : getExpiresLabel(expiresAt)

  const handleChange = async (newPolicy) => {
    setOpen(false)
    await setPolicy(targetType, targetId, newPolicy)
  }

  if (!retentionPolicy && !expired) return null

  return (
    <div className="retention-badge-wrapper" ref={wrapperRef}>
      <span
        className={`retention-badge ${badgeClass}`}
        onClick={() => setOpen(v => !v)}
        title={`Retention: ${retentionPolicy || 'none'}${expiresAt ? ` · Expires ${new Date(expiresAt).toLocaleString()}` : ''}`}
      >
        <span>{icon}</span>
        {!compact && <span>{label}</span>}
      </span>
      {open && (
        <MemoryPolicyDropdown
          currentPolicy={retentionPolicy}
          onChange={handleChange}
        />
      )}
    </div>
  )
}
