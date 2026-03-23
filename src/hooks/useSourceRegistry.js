import { useState, useCallback } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'

export function useSourceRegistry() {
  const { activeWorkspaceId, sources, addSource, removeSource, loadingSources } = useWorkspace()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const ingestText = useCallback(async ({ name, content, retentionPolicy = 'manual' }) => {
    if (!activeWorkspaceId) throw new Error('No active workspace')
    setUploading(true)
    setError(null)
    try {
      return await addSource(activeWorkspaceId, {
        name,
        modality: 'text',
        mimeType: 'text/plain',
        metadata: { content },
        retentionPolicy,
      })
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setUploading(false)
    }
  }, [activeWorkspaceId, addSource])

  const ingestToolOutput = useCallback(async ({ name, content, toolName, retentionPolicy = 'session' }) => {
    if (!activeWorkspaceId) throw new Error('No active workspace')
    setUploading(true)
    setError(null)
    try {
      return await addSource(activeWorkspaceId, {
        name,
        modality: 'tool',
        mimeType: 'application/json',
        metadata: { content, toolName },
        retentionPolicy,
      })
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setUploading(false)
    }
  }, [activeWorkspaceId, addSource])

  const deleteSource = useCallback(async (sourceId) => {
    if (!activeWorkspaceId) return
    await removeSource(activeWorkspaceId, sourceId)
  }, [activeWorkspaceId, removeSource])

  const sourcesByModality = sources.reduce((acc, s) => {
    if (!acc[s.modality]) acc[s.modality] = []
    acc[s.modality].push(s)
    return acc
  }, {})

  return {
    sources,
    sourcesByModality,
    loading: loadingSources,
    uploading,
    error,
    ingestText,
    ingestToolOutput,
    deleteSource,
  }
}
