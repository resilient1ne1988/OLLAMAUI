import React, { useEffect, useRef } from 'react'
import useCaptureDirector from '../../hooks/useCaptureDirector'
import SuggestionCard from './SuggestionCard'
import './CaptureDirector.css'

export default function CaptureDirector({ workspaceId, messageText, onFollowSuggestion }) {
  const { suggestions, loading, sessionDisabled, analyze, dismiss, disableForSession } = useCaptureDirector(workspaceId)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      analyze(messageText)
    }, 800)
    return () => clearTimeout(debounceRef.current)
  }, [messageText, analyze])

  if (sessionDisabled || (!loading && suggestions.length === 0)) return null

  const handleFollow = (suggestion) => {
    if (onFollowSuggestion) onFollowSuggestion(suggestion)
  }

  return (
    <div className="capture-director" role="region" aria-label="Capture Director">
      <div className="capture-director-header">
        <span className="capture-director-label">📡 Capture Director</span>
        <button className="btn-ghost btn-sm" onClick={disableForSession}>
          Disable for session
        </button>
      </div>
      <div className="capture-director-suggestions">
        {suggestions.slice(0, 3).map(s => (
          <SuggestionCard
            key={s.id}
            suggestion={s}
            onDismiss={dismiss}
            onFollow={handleFollow}
          />
        ))}
      </div>
    </div>
  )
}
