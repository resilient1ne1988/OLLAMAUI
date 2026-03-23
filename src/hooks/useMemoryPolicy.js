import { useState, useCallback } from 'react'

export function useMemoryPolicy() {
  const [policies, setPolicies] = useState({})
  const [loading, setLoading] = useState(false)

  const getPolicy = useCallback(async (targetType, targetId) => {
    try {
      const res = await fetch(`/api/memory?targetType=${targetType}&targetId=${targetId}`)
      if (!res.ok) return null
      const data = await res.json()
      const policy = data.data
      if (policy) setPolicies(prev => ({ ...prev, [`${targetType}:${targetId}`]: policy }))
      return policy
    } catch { return null }
  }, [])

  const setPolicy = useCallback(async (targetType, targetId, retentionPolicy) => {
    setLoading(true)
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, retentionPolicy })
      })
      if (!res.ok) throw new Error('Failed to set memory policy')
      const data = await res.json()
      const policy = data.data
      setPolicies(prev => ({ ...prev, [`${targetType}:${targetId}`]: policy }))
      return policy
    } finally {
      setLoading(false)
    }
  }, [])

  const policyFor = (targetType, targetId) => policies[`${targetType}:${targetId}`] || null

  const getExpiringItems = useCallback(async (workspaceId, withinMs = 86400000) => {
    try {
      const res = await fetch(`/api/memory/expiring/${workspaceId}?within=${withinMs}`)
      if (!res.ok) return null
      const data = await res.json()
      return data.data
    } catch { return null }
  }, [])

  const runCleanup = useCallback(async (workspaceId) => {
    try {
      const res = await fetch(`/api/memory/cleanup/${workspaceId}`, { method: 'POST' })
      if (!res.ok) throw new Error('Cleanup failed')
      const data = await res.json()
      return data.data
    } catch (e) { throw e }
  }, [])

  return { getPolicy, setPolicy, policyFor, loading, getExpiringItems, runCleanup }
}

export function getExpiresLabel(expiresAt) {
  if (!expiresAt) return 'Forever'
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return '🗑️ Expired'
  const days = ms / 86400000
  const hours = ms / 3600000
  if (days > 7) return '7d+'
  if (hours > 24) return `${Math.floor(days)}d`
  if (hours > 2) return `${Math.floor(hours)}h`
  return '⚠️ Expires soon'
}

export function isExpired(expiresAt) {
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() <= Date.now()
}
