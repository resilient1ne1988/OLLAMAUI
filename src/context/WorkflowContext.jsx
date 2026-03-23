import React, { createContext, useContext, useState, useCallback } from 'react'

const WorkflowContext = createContext(null)

export function WorkflowProvider({ children }) {
  const [workflows, setWorkflows] = useState([])
  const [running, setRunning] = useState(null)
  const [stepStatuses, setStepStatuses] = useState({})

  const load = useCallback(async () => {
    const data = await fetch('/api/workflows').then(r => r.json()).catch(() => [])
    setWorkflows(Array.isArray(data) ? data : [])
  }, [])

  const save = useCallback(async (wf) => {
    const saved = await fetch('/api/workflows', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...wf, id: wf.id || Date.now().toString() })
    }).then(r => r.json())
    setWorkflows(prev => {
      const idx = prev.findIndex(w => w.id === saved.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = saved; return n }
      return [saved, ...prev]
    })
    return saved
  }, [])

  const remove = useCallback(async (id) => {
    await fetch(`/api/workflows/${id}`, { method: 'DELETE' })
    setWorkflows(prev => prev.filter(w => w.id !== id))
  }, [])

  const runWorkflow = useCallback(async (id, steps) => {
    setRunning(id)
    const initial = {}
    steps.forEach((_, i) => { initial[i] = { status: 'waiting', output: '', chunk: '', duration: null, error: null } })
    setStepStatuses(initial)

    const res = await fetch(`/api/workflows/${id}/run`, { method: 'POST' })
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n'); buf = lines.pop() || ''
      for (const line of lines) {
        const stripped = line.startsWith('data:') ? line.slice(5).trim() : line.trim()
        if (!stripped) continue
        try {
          const evt = JSON.parse(stripped)
          setStepStatuses(prev => {
            const updated = { ...prev }
            if (evt.type === 'step_start') updated[evt.stepIndex] = { ...updated[evt.stepIndex], status: 'running' }
            else if (evt.type === 'step_chunk') updated[evt.stepIndex] = { ...updated[evt.stepIndex], chunk: (updated[evt.stepIndex]?.chunk || '') + evt.chunk }
            else if (evt.type === 'step_done') updated[evt.stepIndex] = { ...updated[evt.stepIndex], status: 'done', output: evt.output, duration: evt.duration }
            else if (evt.type === 'step_error') updated[evt.stepIndex] = { ...updated[evt.stepIndex], status: 'error', error: evt.error }
            else if (evt.type === 'notify' && 'Notification' in window && Notification.permission === 'granted') {
              new Notification(evt.title || 'Workflow', { body: evt.body || '' })
            }
            return updated
          })
          if (evt.type === 'workflow_done' || evt.type === 'aborted') setRunning(null)
        } catch {}
      }
    }
    setRunning(null)
  }, [])

  const abort = useCallback(async (id) => {
    await fetch(`/api/workflows/${id}/abort`, { method: 'POST' })
    setRunning(null)
  }, [])

  return (
    <WorkflowContext.Provider value={{ workflows, running, stepStatuses, load, save, remove, runWorkflow, abort }}>
      {children}
    </WorkflowContext.Provider>
  )
}

export function useWorkflowContext() {
  const ctx = useContext(WorkflowContext)
  if (!ctx) throw new Error('useWorkflowContext must be used inside WorkflowProvider')
  return ctx
}
