import { useState, useCallback } from 'react'

export default function useCaptureDirector(workspaceId) {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [sessionDisabled, setSessionDisabled] = useState(false)

  const analyze = useCallback(async (messageText) => {
    if (!workspaceId || sessionDisabled) return
    setLoading(true)
    try {
      const res = await fetch('/api/capture/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, messageText }),
      })
      if (!res.ok) return
      const data = await res.json()
      setSuggestions(data.data || [])
    } catch {
      // silently fail — capture director is non-critical
    } finally {
      setLoading(false)
    }
  }, [workspaceId, sessionDisabled])

  const dismiss = useCallback(async (suggestionId) => {
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId))
    try {
      await fetch('/api/capture/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId, workspaceId }),
      })
    } catch {
      // best-effort persist
    }
  }, [workspaceId])

  const disableForSession = useCallback(() => {
    setSessionDisabled(true)
    setSuggestions([])
  }, [])

  return { suggestions, loading, sessionDisabled, analyze, dismiss, disableForSession }
}
