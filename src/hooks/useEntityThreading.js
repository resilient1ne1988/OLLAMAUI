import { useState, useCallback } from 'react'

export default function useEntityThreading(workspaceId) {
  const [entities, setEntities] = useState([])
  const [selectedEntity, setSelectedEntity] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadEntities = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/entities/${workspaceId}`)
      const json = await res.json()
      if (json.ok) setEntities(json.data)
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  const createEntity = useCallback(async (name, entityType, description = '') => {
    const res = await fetch('/api/entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, name, entityType, description }),
    })
    const json = await res.json()
    if (json.ok) {
      setEntities(prev => [...prev, json.data])
      return json.data
    }
    throw new Error(json.error)
  }, [workspaceId])

  const updateEntity = useCallback(async (id, patch) => {
    const res = await fetch(`/api/entities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const json = await res.json()
    if (json.ok) {
      setEntities(prev => prev.map(e => e.id === id ? json.data : e))
      if (selectedEntity?.id === id) setSelectedEntity(json.data)
      return json.data
    }
    throw new Error(json.error)
  }, [selectedEntity])

  const deleteEntity = useCallback(async (id) => {
    await fetch(`/api/entities/${id}`, { method: 'DELETE' })
    setEntities(prev => prev.filter(e => e.id !== id))
    if (selectedEntity?.id === id) { setSelectedEntity(null); setDrawerOpen(false) }
  }, [selectedEntity])

  const openDrawer = useCallback((entity) => {
    setSelectedEntity(entity)
    setDrawerOpen(true)
  }, [])

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
  }, [])

  const suggestForText = useCallback(async (text) => {
    if (!workspaceId || !text) return []
    const res = await fetch('/api/entities/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, text }),
    })
    const json = await res.json()
    return json.ok ? json.data : []
  }, [workspaceId])

  const togglePin = useCallback(async (id) => {
    const entity = entities.find(e => e.id === id)
    if (entity) await updateEntity(id, { pinned: !entity.pinned })
  }, [entities, updateEntity])

  return { entities, selectedEntity, drawerOpen, loading, loadEntities, createEntity, updateEntity, deleteEntity, openDrawer, closeDrawer, suggestForText, togglePin }
}
