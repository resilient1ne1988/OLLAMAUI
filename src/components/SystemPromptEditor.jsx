import React, { useState, useEffect, useRef } from 'react'

const STORAGE_KEY = (model) => `ollamaui-system-prompt:${model}`

const DEFAULT_PROMPT = 'You are a helpful assistant. Answer clearly and concisely.'

export default function SystemPromptEditor({ model, onPromptChange }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [saved, setSaved] = useState(false)
  const saveTimer = useRef(null)

  // Load prompt from localStorage when model changes
  useEffect(() => {
    if (!model) { setDraft(''); onPromptChange(''); return }
    const stored = localStorage.getItem(STORAGE_KEY(model)) ?? ''
    setDraft(stored)
    onPromptChange(stored)
  }, [model]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e) => {
    const val = e.target.value
    setDraft(val)
    setSaved(false)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (model) localStorage.setItem(STORAGE_KEY(model), val)
      onPromptChange(val)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }, 500)
  }

  const handleReset = () => {
    if (model) localStorage.removeItem(STORAGE_KEY(model))
    setDraft('')
    onPromptChange('')
    setSaved(false)
  }

  const handleApplyDefault = () => {
    setDraft(DEFAULT_PROMPT)
    if (model) localStorage.setItem(STORAGE_KEY(model), DEFAULT_PROMPT)
    onPromptChange(DEFAULT_PROMPT)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="system-prompt-editor">
      <button
        className="system-prompt-toggle"
        onClick={() => setOpen(v => !v)}
        title={open ? 'Collapse instructions' : 'Edit model instructions'}
      >
        <span className="spe-chevron">{open ? '▾' : '▸'}</span>
        <span className="spe-label">
          {model ? `Instructions for ${model}` : 'Model Instructions'}
        </span>
        {draft.trim() && <span className="spe-active-dot" title="Custom instructions active" />}
      </button>

      {open && (
        <div className="system-prompt-body">
          <textarea
            className="system-prompt-textarea"
            value={draft}
            onChange={handleChange}
            placeholder="Enter a system / instruction prompt for this model… (e.g. 'You are a senior developer. Always respond with code examples.')"
            rows={4}
            spellCheck={false}
          />
          <div className="system-prompt-actions">
            <button className="btn-ghost btn-sm" onClick={handleApplyDefault}>Use default</button>
            <button className="btn-ghost btn-sm btn-danger-ghost" onClick={handleReset} disabled={!draft}>Clear</button>
            <span className="spe-saved-label">{saved ? '✓ Saved' : ''}</span>
            <span className="spe-hint">Takes effect on next message · stored per model</span>
          </div>
        </div>
      )}
    </div>
  )
}
