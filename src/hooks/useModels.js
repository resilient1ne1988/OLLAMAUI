import { useState, useCallback } from 'react'

export function useModels(onToast) {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(false)
  const [pullProgress, setPullProgress] = useState(null)
  const [pullStatus, setPullStatus] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetch('/api/models').then(r => r.json())
      setModels(data.models || [])
    } catch { setModels([]) }
    finally { setLoading(false) }
  }, [])

  const pull = useCallback(async (modelName) => {
    setPullProgress(0)
    setPullStatus('Starting...')
    try {
      const res = await fetch('/api/pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: modelName, stream: true }) })
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        const lines = text.split('\n').filter(l => l.trim())
        for (const line of lines) {
          try {
            const data = JSON.parse(line)
            if (data.status) setPullStatus(data.status)
            if (data.completed && data.total) setPullProgress(Math.round((data.completed / data.total) * 100))
            if (data.status === 'success') { onToast?.('success', `Model ${modelName} pulled successfully`); await refresh() }
          } catch {}
        }
      }
    } catch (e) { onToast?.('error', 'Pull failed: ' + e.message) }
    finally { setPullProgress(null); setPullStatus('') }
  }, [refresh, onToast])

  const deleteModel = useCallback(async (name) => {
    try {
      await fetch('/api/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
      onToast?.('success', `Model ${name} deleted`)
      await refresh()
    } catch (e) { onToast?.('error', 'Delete failed: ' + e.message) }
  }, [refresh, onToast])

  const showDetails = useCallback(async (name) => {
    const data = await fetch('/api/show', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).then(r => r.json())
    return data
  }, [])

  return { models, loading, pull, deleteModel, showDetails, refresh, pullProgress, pullStatus }
}
