import { useState, useEffect, useCallback } from 'react'

/**
 * Manages claim ledger state for a single message.
 * @param {string|null} messageId
 */
export default function useClaimLedger(messageId) {
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filterMode, setFilterMode] = useState('all')
  const [regeneratingIds, setRegeneratingIds] = useState(new Set())

  // Fetch existing claims whenever messageId changes
  useEffect(() => {
    if (!messageId) {
      setClaims([])
      return
    }
    setLoading(true)
    setError(null)
    fetch(`/api/messages/${messageId}/claims`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) setClaims(d.data)
        else setError(d.error)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [messageId])

  const regenerateClaim = useCallback(async (claimId) => {
    if (!messageId) return
    setRegeneratingIds(prev => new Set([...prev, claimId]))
    try {
      const r = await fetch(`/api/messages/${messageId}/claims/segment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId }),
      })
      const d = await r.json()
      if (d.ok) setClaims(d.data)
      else setError(d.error)
    } catch (e) {
      setError(e.message)
    } finally {
      setRegeneratingIds(prev => { const s = new Set(prev); s.delete(claimId); return s })
    }
  }, [messageId])

  /**
   * POST text to the segment endpoint, persist claims, update state.
   * @param {string} text - full assistant message text
   * @param {Array} sources - available source chunks for classification
   */
  const segmentClaims = useCallback(async (text, sources = []) => {
    if (!messageId || !text) return
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/messages/${messageId}/claims/segment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sources }),
      })
      const d = await r.json()
      if (d.ok) setClaims(d.data)
      else setError(d.error)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [messageId])

  // Derived filtered view
  const filteredClaims = claims.filter(c => {
    if (filterMode === 'all') return true
    if (filterMode === 'contradicted') return c.supportTypes.includes('contradicted')
    if (filterMode === 'weak') return c.supportTypes.some(t => t === 'inferred' || t === 'unsupported')
    return true
  })

  return { claims, loading, error, segmentClaims, regenerateClaim, regeneratingIds, filterMode, setFilterMode, filteredClaims }
}
