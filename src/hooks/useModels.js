import { useState, useCallback } from 'react'
import { useOllama } from '../context/OllamaContext'

export function useModels(onToast) {
  const { refreshModels } = useOllama()
  const [loading, setLoading] = useState(false)
  const [pullProgress, setPullProgress] = useState(null)
  const [pullStatus, setPullStatus] = useState('')

  const pull = useCallback(async (modelName) => {
    setLoading(true)
    setPullProgress(0)
    setPullStatus('Starting...')
    try {
      const res = await fetch('/api/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: true })
      })
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        for (const line of text.split('\n').filter(l => l.trim())) {
          try {
            const data = JSON.parse(line)
            if (data.status) setPullStatus(data.status)
            if (data.completed && data.total) setPullProgress(Math.round((data.completed / data.total) * 100))
            if (data.status === 'success') {
              onToast?.('success', `Model ${modelName} pulled successfully`)
              await refreshModels()
            }
          } catch {}
        }
      }
    } catch (e) { onToast?.('error', 'Pull failed: ' + e.message) }
    finally { setLoading(false); setPullProgress(null); setPullStatus('') }
  }, [refreshModels, onToast])

  const deleteModel = useCallback(async (name) => {
    try {
      await fetch('/api/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
      onToast?.('success', `Model ${name} deleted`)
      await refreshModels()
    } catch (e) { onToast?.('error', 'Delete failed: ' + e.message) }
  }, [refreshModels, onToast])

  const showDetails = useCallback(async (name) => {
    const data = await fetch('/api/show', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).then(r => r.json())
    return data
  }, [])

  return { loading, pull, deleteModel, showDetails, pullProgress, pullStatus }
}