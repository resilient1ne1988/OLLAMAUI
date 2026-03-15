import { useState, useEffect, useCallback } from 'react'

export function usePersistence() {
  const [sessions, setSessions] = useState([])
  const [settings, setSettings] = useState({})

  const loadSessions = useCallback(async () => {
    try {
      const data = await fetch('/api/sessions').then(r => r.json())
      setSessions(Array.isArray(data) ? data : [])
    } catch { setSessions([]) }
  }, [])

  const loadSettings = useCallback(async () => {
    try {
      const data = await fetch('/api/settings').then(r => r.json())
      setSettings(data || {})
    } catch { setSettings({}) }
  }, [])

  useEffect(() => { loadSessions(); loadSettings() }, [loadSessions, loadSettings])

  const saveSession = useCallback(async (session) => {
    const saved = await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(session) }).then(r => r.json())
    setSessions(prev => {
      const idx = prev.findIndex(s => s.id === saved.id)
      if (idx >= 0) { const updated = [...prev]; updated[idx] = saved; return updated }
      return [saved, ...prev]
    })
    return saved
  }, [])

  const deleteSession = useCallback(async (id) => {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    setSessions(prev => prev.filter(s => s.id !== id))
  }, [])

  const saveSettings = useCallback(async (newSettings) => {
    const merged = { ...settings, ...newSettings }
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(merged) })
    setSettings(merged)
    return merged
  }, [settings])

  return { sessions, saveSession, deleteSession, loadSession: (id) => sessions.find(s => s.id === id), settings, saveSettings, reloadSessions: loadSessions }
}
