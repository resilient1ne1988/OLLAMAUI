import React, { createContext, useContext, useState, useCallback } from 'react'
const ChatHistoryContext = createContext(null)

export function ChatHistoryProvider({ children }) {
  const [sessions, setSessions] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState(null)

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions')
      if (!res.ok) return
      setSessions(await res.json())
      setLoaded(true)
    } catch { setLoaded(true) }
  }, [])

  const saveSession = useCallback(async (session) => {
    const id = session.id || crypto.randomUUID()
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...session, id })
      })
      if (!res.ok) return null
      const saved = await res.json()
      setSessions(prev => {
        const idx = prev.findIndex(s => s.id === saved.id)
        if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
        return [saved, ...prev]
      })
      return saved
    } catch { return null }
  }, [])

  const autoSave = useCallback(async (messages, model, provider = 'ollama') => {
    if (!messages || messages.length === 0) return null
    const id = activeSessionId || crypto.randomUUID()
    const name = messages[0]?.content?.slice(0, 50) || 'Chat ' + new Date().toLocaleString()
    const session = { id, name, messages, model, provider, updatedAt: Date.now() }
    const saved = await saveSession(session)
    if (saved && !activeSessionId) setActiveSessionId(saved.id)
    return saved
  }, [activeSessionId, saveSession])

  const startNewSession = useCallback(() => { setActiveSessionId(null) }, [])

  const deleteSession = useCallback(async (id) => {
    try {
      await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
      setSessions(prev => prev.filter(s => s.id !== id))
      if (id === activeSessionId) setActiveSessionId(null)
    } catch {}
  }, [activeSessionId])

  const loadSessionById = useCallback((id) => {
    return sessions.find(s => s.id === id) || null
  }, [sessions])

  return (
    <ChatHistoryContext.Provider value={{
      sessions, loaded, activeSessionId, setActiveSessionId,
      loadSessions, saveSession, autoSave, startNewSession, deleteSession, loadSessionById
    }}>
      {children}
    </ChatHistoryContext.Provider>
  )
}

export const useChatHistory = () => {
  const ctx = useContext(ChatHistoryContext)
  if (!ctx) throw new Error('useChatHistory must be used inside ChatHistoryProvider')
  return ctx
}