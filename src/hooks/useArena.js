import { useState, useCallback, useRef } from 'react'

export function useArena() {
  const [modelOutputs, setModelOutputs] = useState({}) // { [modelIndex]: { content, metrics, status, model } }
  const [isRunning, setIsRunning] = useState(false)
  const esRef = useRef(null)

  const run = useCallback(async (prompt, models) => {
    if (!prompt.trim() || models.length === 0) return
    // Reset state
    const initial = {}
    models.forEach((m, i) => { initial[i] = { content: '', metrics: null, status: 'waiting', model: m } })
    setModelOutputs(initial)
    setIsRunning(true)

    const res = await fetch('/api/arena/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, models })
    })

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const stripped = line.startsWith('data:') ? line.slice(5).trim() : line.trim()
        if (!stripped) continue
        try {
          const evt = JSON.parse(stripped)
          setModelOutputs(prev => {
            const updated = { ...prev }
            const entry = { ...updated[evt.modelIndex] }
            if (evt.type === 'chunk') { entry.content += evt.chunk; entry.status = 'streaming' }
            else if (evt.type === 'done') { entry.metrics = evt.metrics; entry.status = 'done' }
            else if (evt.type === 'error') { entry.status = 'error'; entry.content = evt.error }
            updated[evt.modelIndex] = entry
            return updated
          })
        } catch {}
      }
    }
    setIsRunning(false)
  }, [])

  const stop = useCallback(() => {
    setIsRunning(false)
  }, [])

  const reset = useCallback(() => {
    setModelOutputs({})
    setIsRunning(false)
  }, [])

  return { modelOutputs, isRunning, run, stop, reset }
}
