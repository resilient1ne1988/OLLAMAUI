import React, { useState, useEffect, useCallback } from 'react'

const CATEGORIES = ['BTC', 'System', 'Dev', 'Research', 'Other']

function TokenBadge({ token }) {
  return <span className="token-badge">{'{{' + token + '}}'}</span>
}

function extractTokens(template) {
  const matches = template.match(/\{\{([^}]+)\}\}/g) || []
  return [...new Set(matches.map(m => m.slice(2, -2)))]
}

function PromptCard({ prompt, onEdit, onDelete, onUse }) {
  const tokens = extractTokens(prompt.template || '')
  return (
    <div className="prompt-card">
      <div className="prompt-card-header">
        <span className="prompt-title">{prompt.title}</span>
        <span className="badge badge-blue">{prompt.category}</span>
      </div>
      <div className="prompt-preview">{(prompt.template || '').slice(0, 120)}{prompt.template?.length > 120 ? '…' : ''}</div>
      {tokens.length > 0 && (
        <div className="prompt-tokens">
          {tokens.map(t => <TokenBadge key={t} token={t} />)}
        </div>
      )}
      <div className="prompt-card-actions">
        <button className="btn-primary btn-sm" onClick={() => onUse(prompt)}>⚡ Use</button>
        <button className="btn-secondary btn-sm" onClick={() => onEdit(prompt)}>✏️ Edit</button>
        <button className="btn-ghost btn-sm" onClick={() => onDelete(prompt.id)}>🗑</button>
      </div>
      {prompt.useCount > 0 && <div className="prompt-use-count">Used {prompt.useCount}× </div>}
    </div>
  )
}

const EMPTY_PROMPT = { title: '', category: 'BTC', template: '' }

function PromptEditor({ prompt, onSave, onClose }) {
  const [form, setForm] = useState(prompt || EMPTY_PROMPT)
  const [preview, setPreview] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const setF = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const resolvePreview = async () => {
    setPreviewing(true)
    try {
      const res = await fetch('/api/prompts/resolve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: form.template, context: {} })
      })
      const data = await res.json()
      setPreview(data.resolved || '')
    } catch { setPreview('(preview failed)') }
    setPreviewing(false)
  }

  const insertToken = (token) => setF('template', form.template + `{{${token}}}`)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{form.id ? 'Edit Prompt' : 'New Prompt'}</h3>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-field">
            <label className="form-label">Title</label>
            <input className="text-input" value={form.title} onChange={e => setF('title', e.target.value)} placeholder="Prompt name" />
          </div>
          <div className="form-field">
            <label className="form-label">Category</label>
            <select className="text-input" value={form.category} onChange={e => setF('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Template</label>
            <div className="token-insert-row">
              {['DATE', 'TIME', 'BTC_PRICE', 'CLIPBOARD', 'SESSION_CONTEXT'].map(t => (
                <button key={t} className="btn-ghost btn-xs" onClick={() => insertToken(t)}>+{`{{${t}}}`}</button>
              ))}
            </div>
            <textarea className="text-input" rows={6} value={form.template} onChange={e => setF('template', e.target.value)} placeholder="Write your prompt template. Use {{DATE}}, {{BTC_PRICE}}, {{SHELL:cmd}}, etc." />
          </div>
          {preview && (
            <div className="prompt-preview-box">
              <div className="form-label">Preview (resolved)</div>
              <pre className="code-block" style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>{preview}</pre>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary btn-sm" onClick={resolvePreview} disabled={previewing}>
            {previewing ? '⏳' : '👁 Preview'}
          </button>
          <button className="btn-primary btn-sm" onClick={() => onSave(form)} disabled={!form.title || !form.template}>
            💾 Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PromptArsenal() {
  const [prompts, setPrompts] = useState([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [editing, setEditing] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 2500) }

  const load = useCallback(async () => {
    const data = await fetch('/api/prompts').then(r => r.json()).catch(() => [])
    setPrompts(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => { load() }, [load])

  // Ctrl+P global shortcut
  useEffect(() => {
    const handler = (e) => { if (e.ctrlKey && e.key === 'p') { e.preventDefault(); setShowEditor(true); setEditing(null) } }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSave = async (form) => {
    const saved = await fetch('/api/prompts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, id: form.id || Date.now().toString() })
    }).then(r => r.json())
    setPrompts(prev => {
      const idx = prev.findIndex(p => p.id === saved.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = saved; return n }
      return [saved, ...prev]
    })
    setShowEditor(false)
    showToast('✅ Prompt saved')
  }

  const handleDelete = async (id) => {
    await fetch(`/api/prompts/${id}`, { method: 'DELETE' })
    setPrompts(prev => prev.filter(p => p.id !== id))
    showToast('🗑 Prompt deleted')
  }

  const handleUse = async (prompt) => {
    try {
      let clipboard = ''
      try { clipboard = await navigator.clipboard.readText() } catch {}
      const res = await fetch('/api/prompts/resolve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: prompt.template, context: { clipboard } })
      })
      const data = await res.json()
      await navigator.clipboard.writeText(data.resolved || prompt.template)
      showToast('⚡ Resolved prompt copied to clipboard!')
    } catch { showToast('❌ Failed to resolve prompt') }
  }

  const filtered = prompts.filter(p => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase())
    const matchCat = !catFilter || p.category === catFilter
    return matchSearch && matchCat
  })

  const categories = [...new Set(prompts.map(p => p.category))]

  return (
    <div className="page prompt-arsenal-page">
      <div className="page-header">
        <h1 className="page-title">⚡ Prompt Arsenal</h1>
        <div className="page-actions">
          <button className="btn-primary btn-sm" onClick={() => { setEditing(null); setShowEditor(true) }}>+ New Prompt</button>
        </div>
      </div>

      {toastMsg && <div className="toast">{toastMsg}</div>}

      <div className="prompt-filters">
        <input className="text-input" style={{ maxWidth: 280 }} placeholder="🔍 Search prompts… (Ctrl+P)" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="cat-filters">
          <button className={`badge ${!catFilter ? 'badge-blue' : 'badge-gray'}`} onClick={() => setCatFilter('')}>All</button>
          {categories.map(c => (
            <button key={c} className={`badge ${catFilter === c ? 'badge-blue' : 'badge-gray'}`} onClick={() => setCatFilter(c)}>{c}</button>
          ))}
        </div>
      </div>

      <div className="prompt-grid">
        {filtered.length === 0 && <div className="empty-state">No prompts found. Create your first prompt template!</div>}
        {filtered.map(p => (
          <PromptCard key={p.id} prompt={p}
            onEdit={(p) => { setEditing(p); setShowEditor(true) }}
            onDelete={handleDelete}
            onUse={handleUse}
          />
        ))}
      </div>

      {showEditor && (
        <PromptEditor
          prompt={editing}
          onSave={handleSave}
          onClose={() => { setShowEditor(false); setEditing(null) }}
        />
      )}
    </div>
  )
}
