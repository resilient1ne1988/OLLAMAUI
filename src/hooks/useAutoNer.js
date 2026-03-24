import { useState, useCallback, useEffect, useRef } from 'react'

export function useAutoNer(workspaceId) {
  const [suggestions, setSuggestions] = useState([])
  const abortRef = useRef(null)

  // Clear suggestions when workspace changes
  useEffect(() => {
    setSuggestions([])
    return () => { abortRef.current?.abort() }
  }, [workspaceId])

  const extractFromText = useCallback(async (text) => {
    if (!workspaceId || !text) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await fetch(`/api/entities/${workspaceId}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      })
      const data = await res.json()
      setSuggestions(data.entities || [])
    } catch (e) {
      if (e.name !== 'AbortError') console.error('useAutoNer:', e)
    }
  }, [workspaceId])

  const dismiss = useCallback((text) => {
    setSuggestions(prev => prev.filter(s => s.text !== text))
  }, [])

  return { suggestions, extractFromText, dismiss }
}
