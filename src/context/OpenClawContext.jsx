import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

const OpenClawContext = createContext(null)

export function OpenClawProvider({ children }) {
  const [agents, setAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState('')
  const [openclawConnected, setOpenclawConnected] = useState(false)
  const [onlineMode, setOnlineMode] = useState(true)

  const checkOpenClaw = useCallback(async () => {
    try {
      const res = await fetch('/api/openclaw/status')
      if (!res.ok) throw new Error('not ok')
      setOpenclawConnected(true)
    } catch {
      setOpenclawConnected(false)
    }
  }, [])

  useEffect(() => {
    fetch('/api/openclaw/agents')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && Array.isArray(d)) {
          setAgents(d)
          if (d.length > 0) setSelectedAgent(prev => prev || d[0].id || d[0].name || '')
        }
      })
      .catch(() => {})

    checkOpenClaw()
  }, [checkOpenClaw])

  return (
    <OpenClawContext.Provider value={{
      agents,
      selectedAgent,
      setSelectedAgent,
      openclawConnected,
      onlineMode,
      setOnlineMode,
      checkOpenClaw
    }}>
      {children}
    </OpenClawContext.Provider>
  )
}

export const useOpenClaw = () => {
  const ctx = useContext(OpenClawContext)
  if (!ctx) throw new Error('useOpenClaw must be used inside OpenClawProvider')
  return ctx
}
