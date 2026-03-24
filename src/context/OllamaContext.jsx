import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { OLLAMA_POLL_INTERVAL_MS } from '../constants'
import { useSettings } from './SettingsContext'

const OllamaContext = createContext(null)

export function OllamaProvider({ children }) {
  const { settings } = useSettings()
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState('')
  const [connected, setConnected] = useState(null) // null=checking, true, false

  const checkConnection = useCallback(async () => {
    try {
      const res = await fetch('/api/models')
      if (!res.ok) throw new Error('not ok')
      const data = await res.json()
      const modelList = data.models || []
      setModels(modelList)
      setConnected(true)
      if (modelList.length > 0) {
        setSelectedModel(prev => prev || modelList[0].name)
      }
    } catch {
      setConnected(false)
      setModels([])
    }
  }, [])

  const refreshModels = checkConnection

  const intervalRef = useRef(null)

  // Re-check connection when ollamaUrl setting changes
  useEffect(() => {
    if (settings.ollamaUrl) checkConnection()
  }, [settings.ollamaUrl, checkConnection])

  useEffect(() => {
    checkConnection()
    intervalRef.current = setInterval(checkConnection, OLLAMA_POLL_INTERVAL_MS)

    const handleVisibility = () => {
      if (document.hidden) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current)
        checkConnection()
        intervalRef.current = setInterval(checkConnection, OLLAMA_POLL_INTERVAL_MS)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [checkConnection])

  return (
    <OllamaContext.Provider value={{ models, selectedModel, setSelectedModel, connected, checkConnection, refreshModels }}>
      {children}
    </OllamaContext.Provider>
  )
}

export const useOllama = () => {
  const ctx = useContext(OllamaContext)
  if (!ctx) throw new Error('useOllama must be used inside OllamaProvider')
  return ctx
}
