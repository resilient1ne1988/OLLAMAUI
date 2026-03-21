import React, { createContext, useContext, useState, useCallback } from 'react'

const ChatHistoryContext = createContext(null)

export function ChatHistoryProvider({ children }) {
  const [sessions, setSessions] = useState([])
  const [loaded, setLoaded] = useState(false)

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions')
      if (!res.ok) return
      const data = await res.json()
      setSessions(data)
      setLoaded(true)
    } catch {
      setLoaded(true)
    }
  }, [])

  const saveSession = useCallback(async (session) => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session)
      })
      if (!res.ok) return
      const saved = await res.json()
      setSessions(prev => {
        const idx = prev.findIndex(s => s.id === saved.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = saved
          return next
        }
        return [saved, ...prev]
      })
      return saved
    } catch {
      return null
    }
  }, [])

  const deleteSession = useCallback(async (id) => {
    try {
      await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
      setSessions(prev => prev.filter(s => s.id !== id))
    } catch {}
  }, [])

  return (
    <ChatHistoryContext.Provider value={{ sessions, loaded, loadSessions, saveSession, deleteSession }}>
      {children}
    </ChatHistoryContext.Provider>
  )
}

export const useChatHistory = () => {
  const ctx = useContext(ChatHistoryContext)
  if (!ctx) throw new Error('useChatHistory must be used inside ChatHistoryProvider')
  return ctx
}
