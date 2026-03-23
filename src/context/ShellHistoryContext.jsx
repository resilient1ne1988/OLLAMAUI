import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

const ShellHistoryContext = createContext(null)

export function ShellHistoryProvider({ children }) {
  const [entries, setEntries] = useState([])
  const [lastSyncAt, setLastSyncAt] = useState(0)

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/shell-history')
      if (!res.ok) return
      const data = await res.json()
      setEntries(Array.isArray(data) ? data : [])
      const newest = data[0]?.timestamp || 0
      setLastSyncAt(newest)
    } catch {}
  }, [])

  const refresh = useCallback(async () => {
    try {
      const url = lastSyncAt > 0 ? `/api/shell-history?since=${lastSyncAt}` : '/api/shell-history'
      const res = await fetch(url)
      if (!res.ok) return
      const newEntries = await res.json()
      if (!newEntries.length) return
      setEntries(prev => {
        const ids = new Set(prev.map(e => e.timestamp))
        const fresh = newEntries.filter(e => !ids.has(e.timestamp))
        return [...fresh, ...prev]
      })
      const newest = newEntries[0]?.timestamp || lastSyncAt
      setLastSyncAt(newest)
    } catch {}
  }, [lastSyncAt])

  const addEntry = useCallback((entry) => {
    if (!entry) return
    setEntries(prev => [entry, ...prev])
    setLastSyncAt(entry.timestamp || Date.now())
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  useEffect(() => {
    const handle = () => { if (!document.hidden) refresh() }
    document.addEventListener('visibilitychange', handle)
    return () => document.removeEventListener('visibilitychange', handle)
  }, [refresh])

  return (
    <ShellHistoryContext.Provider value={{ entries, lastSyncAt, addEntry, refresh, loadHistory }}>
      {children}
    </ShellHistoryContext.Provider>
  )
}

export const useShellHistory = () => {
  const ctx = useContext(ShellHistoryContext)
  if (!ctx) throw new Error('useShellHistory must be used inside ShellHistoryProvider')
  return ctx
}