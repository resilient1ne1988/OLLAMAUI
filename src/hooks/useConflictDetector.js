import { useState, useCallback } from 'react'

export default function useConflictDetector(workspaceId) {
  const [conflicts, setConflicts] = useState([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const detect = useCallback(async (messageId) => {
    if (!workspaceId || !messageId) return
    setLoading(true)
    try {
      const res = await fetch('/api/conflicts/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, messageId }),
      })
      if (!res.ok) return
      const data = await res.json()
      setConflicts(data.data || [])
    } catch {}
    finally { setLoading(false) }
  }, [workspaceId])

  const loadConflicts = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/conflicts/${workspaceId}`)
      if (!res.ok) return
      const data = await res.json()
      setConflicts(data.data || [])
    } catch {}
    finally { setLoading(false) }
  }, [workspaceId])

  const resolveConflict = useCallback(async (conflictId, authoritativeSourceRefId) => {
    try {
      const body = { authoritativeSourceRefId }
      const res = await fetch(`/api/conflicts/${conflictId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) return
      setConflicts(prev =>
        prev.map(c => c.id === conflictId ? { ...c, resolved: true, authoritativeSourceRefId } : c)
      )
    } catch {}
  }, [])

  const toggleExpanded = useCallback(() => setExpanded(prev => !prev), [])

  return { conflicts, loading, expanded, detect, loadConflicts, resolveConflict, toggleExpanded }
}
