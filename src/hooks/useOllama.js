import { useState, useEffect, useCallback } from 'react'

export function useOllama() {
  const [connected, setConnected] = useState(null)
  const [models, setModels] = useState([])
  const [runningModels, setRunningModels] = useState([])
  const [version, setVersion] = useState(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const health = await fetch('/api/health').then(r => r.json())
      setConnected(!!health.status)
      const mRes = await fetch('/api/models').then(r => r.json())
      setModels(mRes.models || [])
      const ps = await fetch('/api/ps').then(r => r.json())
      setRunningModels(ps.models || [])
      const ver = await fetch('/api/ollama-version').then(r => r.json())
      setVersion(ver.version || null)
    } catch {
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 15000)
    return () => clearInterval(interval)
  }, [refresh])

  return { connected, models, runningModels, version, refresh, loading }
}
