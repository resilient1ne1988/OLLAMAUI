import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

const OllamaContext = createContext(null)

export function OllamaProvider({ children }) {
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

  useEffect(() => {
    checkConnection()
    const interval = setInterval(checkConnection, 15000)
    return () => clearInterval(interval)
  }, [checkConnection])

  return (
    <OllamaContext.Provider value={{ models, selectedModel, setSelectedModel, connected, checkConnection }}>
      {children}
    </OllamaContext.Provider>
  )
}

export const useOllama = () => {
  const ctx = useContext(OllamaContext)
  if (!ctx) throw new Error('useOllama must be used inside OllamaProvider')
  return ctx
}
