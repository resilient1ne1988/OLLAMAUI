import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

const WorkspaceContext = createContext(null)

export function WorkspaceProvider({ children }) {
  const [workspaces, setWorkspaces] = useState([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null)
  const [workspaceContext, setWorkspaceContext] = useState(null)
  const [sources, setSources] = useState([])
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false)
  const [loadingSources, setLoadingSources] = useState(false)

  const loadWorkspaces = useCallback(async () => {
    setLoadingWorkspaces(true)
    try {
      const res = await fetch('/api/workspaces')
      if (!res.ok) return
      const data = await res.json()
      const list = data.data || []
      setWorkspaces(list)
      if (list.length > 0 && !activeWorkspaceId) {
        setActiveWorkspaceId(list[0].id)
      }
    } catch {}
    finally { setLoadingWorkspaces(false) }
  }, [activeWorkspaceId])

  const loadSources = useCallback(async (workspaceId) => {
    if (!workspaceId) return
    setLoadingSources(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/sources`)
      if (!res.ok) return
      const data = await res.json()
      setSources(data.data || [])
    } catch {}
    finally { setLoadingSources(false) }
  }, [])

  const loadWorkspaceContext = useCallback(async (workspaceId) => {
    if (!workspaceId) return
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/context`)
      if (!res.ok) return
      const data = await res.json()
      setWorkspaceContext(data.data || null)
    } catch {}
  }, [])

  const createWorkspace = useCallback(async ({ name, description, retentionPolicyDefault }) => {
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, retentionPolicyDefault })
    })
    if (!res.ok) throw new Error('Failed to create workspace')
    const data = await res.json()
    await loadWorkspaces()
    return data.data
  }, [loadWorkspaces])

  const addSource = useCallback(async (workspaceId, sourceData) => {
    const res = await fetch(`/api/workspaces/${workspaceId}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sourceData)
    })
    if (!res.ok) throw new Error('Failed to add source')
    const data = await res.json()
    setSources(prev => [data.data, ...prev])
    return data.data
  }, [])

  const removeSource = useCallback(async (workspaceId, sourceId) => {
    await fetch(`/api/workspaces/${workspaceId}/sources/${sourceId}`, { method: 'DELETE' })
    setSources(prev => prev.filter(s => s.id !== sourceId))
  }, [])

  useEffect(() => { loadWorkspaces() }, [loadWorkspaces])

  useEffect(() => {
    if (activeWorkspaceId) {
      loadSources(activeWorkspaceId)
      loadWorkspaceContext(activeWorkspaceId)
    }
  }, [activeWorkspaceId, loadSources, loadWorkspaceContext])

  return (
    <WorkspaceContext.Provider value={{
      workspaces, activeWorkspaceId, setActiveWorkspaceId,
      workspaceContext, sources, loadingWorkspaces, loadingSources,
      createWorkspace, addSource, removeSource,
      reload: () => { loadWorkspaces(); if (activeWorkspaceId) loadSources(activeWorkspaceId) }
    }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return ctx
}
