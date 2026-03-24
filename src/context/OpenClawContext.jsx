import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useSettings } from './SettingsContext'

const OpenClawContext = createContext(null)

export function OpenClawProvider({ children }) {
  const { settings } = useSettings()
  const [agents, setAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState('')
  const [provider, setProvider] = useState('ollama')
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
        const list = Array.isArray(d) ? d : (Array.isArray(d?.agents) ? d.agents : [])
        if (list.length > 0) {
          setAgents(list)
          setSelectedAgent(prev => prev || list[0].id || list[0].name || '')
        } else {
          setAgents([])
        }
      })
      .catch(() => {})

    checkOpenClaw()
  }, [checkOpenClaw])

  // Re-check OpenClaw health when port setting changes
  useEffect(() => {
    if (settings.openclawPort) checkOpenClaw()
  }, [settings.openclawPort, checkOpenClaw])

  return (
    <OpenClawContext.Provider value={{
      agents,
      selectedAgent,
      setSelectedAgent,
      provider,
      setProvider,
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
