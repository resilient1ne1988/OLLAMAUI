import { useState, useEffect, useCallback } from 'react'

export function useSignalFeed() {
  const [schedules, setSchedules] = useState([])
  const [results, setResults] = useState([])
  const [running, setRunning] = useState(new Set())

  const loadSchedules = useCallback(async () => {
    const data = await fetch('/api/signals/schedules').then(r => r.json()).catch(() => [])
    setSchedules(Array.isArray(data) ? data : [])
  }, [])

  const loadResults = useCallback(async () => {
    const data = await fetch('/api/signals/results').then(r => r.json()).catch(() => [])
    setResults(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => { loadSchedules(); loadResults() }, [loadSchedules, loadResults])

  useEffect(() => {
    const es = new EventSource('/api/signals/feed')
    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data)
        if (evt.type === 'run_start') {
          setRunning(prev => new Set([...prev, evt.scheduleId]))
        } else if (evt.type === 'run_done') {
          setRunning(prev => { const n = new Set(prev); n.delete(evt.scheduleId); return n })
          if (evt.result) setResults(prev => [evt.result, ...prev].slice(0, 200))
        }
      } catch {}
    }
    return () => es.close()
  }, [])

  const saveSchedule = useCallback(async (schedule) => {
    const saved = await fetch('/api/signals/schedules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(schedule)
    }).then(r => r.json())
    setSchedules(prev => {
      const idx = prev.findIndex(s => s.id === saved.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = saved; return n }
      return [saved, ...prev]
    })
    return saved
  }, [])

  const deleteSchedule = useCallback(async (id) => {
    await fetch(`/api/signals/schedules/${id}`, { method: 'DELETE' })
    setSchedules(prev => prev.filter(s => s.id !== id))
  }, [])

  const runNow = useCallback(async (id) => {
    await fetch(`/api/signals/schedules/${id}/run-now`, { method: 'POST' })
  }, [])

  return { schedules, results, running, saveSchedule, deleteSchedule, runNow, loadSchedules }
}
