import React, { useState, useEffect, useCallback } from 'react'

// ── Search Tab ─────────────────────────────────────────────────────────
function SearchResult({ result }) {
  const { pre, match, post } = result.snippet || {}
  return (
    <div className="search-result-card">
      <div className="search-result-header">
        <span className="search-session-name">{result.sessionName || 'Untitled Session'}</span>
        <span className="search-result-meta">{result.role} · {result.sessionDate ? new Date(result.sessionDate).toLocaleDateString() : ''}</span>
      </div>
      <div className="search-snippet">
        {pre && <span className="snippet-context">{pre}</span>}
        {match && <mark className="snippet-match">{match}</mark>}
        {post && <span className="snippet-context">{post}</span>}
      </div>
    </div>
  )
}

function SearchTab() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  const search = useCallback(async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=20`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
    } catch { setResults([]) }
    setSearching(false)
  }, [query])

  const handleKey = (e) => { if (e.key === 'Enter') search() }

  return (
    <div>
      <div className="intelligence-search-bar">
        <input
          className="text-input"
          style={{ flex: 1 }}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Search across all sessions… (Enter to search)"
        />
        <button className="btn-primary btn-sm" onClick={search} disabled={searching || !query.trim()}>
          {searching ? '⏳' : '🔍 Search'}
        </button>
      </div>
      {results.length === 0 && query && !searching && (
        <div className="empty-state">No results found for "{query}"</div>
      )}
      <div className="search-results">
        {results.map((r, i) => <SearchResult key={i} result={r} />)}
      </div>
    </div>
  )
}

// ── Timeline Tab ───────────────────────────────────────────────────────
function SentimentDot({ sentiment }) {
  const color = sentiment === 'bullish' ? '#22c55e' : sentiment === 'bearish' ? '#ef4444' : '#eab308'
  return <span className="sentiment-dot" style={{ background: color }} title={sentiment} />
}

function InsightCard({ session, insight, onExtract, extracting }) {
  return (
    <div className="insight-card">
      <div className="insight-timeline-dot" />
      <div className="insight-body">
        <div className="insight-header">
          <span className="insight-session-name">{session.name || 'Untitled'}</span>
          <span className="insight-date">{session.updatedAt ? new Date(session.updatedAt).toLocaleDateString() : ''}</span>
        </div>
        {insight ? (
          <>
            <div className="insight-meta">
              <SentimentDot sentiment={insight.sentiment} />
              <span className="insight-sentiment">{insight.sentiment}</span>
              <span className="insight-score">Score: {insight.score}/10</span>
            </div>
            {insight.keyPoints?.length > 0 && (
              <ul className="insight-points">
                {insight.keyPoints.slice(0, 3).map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            )}
            {insight.actionable && <div className="insight-actionable">→ {insight.actionable}</div>}
          </>
        ) : (
          <div className="insight-no-data">
            <span>No insights extracted yet.</span>
            <button className="btn-secondary btn-sm" onClick={() => onExtract(session.id)} disabled={extracting}>
              {extracting ? '⏳ Extracting…' : '🧠 Extract'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function TimelineTab() {
  const [sessions, setSessions] = useState([])
  const [insights, setInsights] = useState({})
  const [extractingAll, setExtractingAll] = useState(false)
  const [extractProgress, setExtractProgress] = useState(null)
  const [extractingId, setExtractingId] = useState(null)

  const load = useCallback(async () => {
    const [sessData, insightData] = await Promise.all([
      fetch('/api/sessions').then(r => r.json()).catch(() => []),
      fetch('/api/intelligence/insights').then(r => r.json()).catch(() => ({}))
    ])
    setSessions(Array.isArray(sessData) ? sessData : [])
    setInsights(typeof insightData === 'object' ? insightData : {})
  }, [])

  useEffect(() => { load() }, [load])

  const extractOne = useCallback(async (sessionId) => {
    setExtractingId(sessionId)
    try {
      const res = await fetch(`/api/intelligence/extract/${sessionId}`, { method: 'POST' })
      const insight = await res.json()
      setInsights(prev => ({ ...prev, [sessionId]: insight }))
    } catch {}
    setExtractingId(null)
  }, [])

  const extractAll = useCallback(async () => {
    setExtractingAll(true)
    setExtractProgress({ done: 0, total: 0 })
    const res = await fetch('/api/intelligence/extract-batch', { method: 'POST' })
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n'); buf = lines.pop() || ''
      for (const line of lines) {
        const stripped = line.startsWith('data:') ? line.slice(5).trim() : line.trim()
        if (!stripped) continue
        try {
          const evt = JSON.parse(stripped)
          if (evt.type === 'progress') setExtractProgress({ done: evt.done, total: evt.total })
          if (evt.type === 'complete') { await load(); setExtractProgress(null) }
        } catch {}
      }
    }
    setExtractingAll(false)
  }, [load])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button className="btn-primary btn-sm" onClick={extractAll} disabled={extractingAll}>
          {extractingAll ? `⏳ Extracting… ${extractProgress ? `${extractProgress.done}/${extractProgress.total}` : ''}` : '🧠 Extract All Insights'}
        </button>
        <span className="form-label" style={{ margin: 0 }}>{Object.keys(insights).length} sessions with insights</span>
      </div>
      <div className="intelligence-timeline">
        {sessions.length === 0 && <div className="empty-state">No sessions found. Start some chats first!</div>}
        {sessions.map(s => (
          <InsightCard
            key={s.id} session={s} insight={insights[s.id]}
            onExtract={extractOne} extracting={extractingId === s.id}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────
export default function ConversationIntelligence() {
  const [tab, setTab] = useState('search')

  return (
    <div className="page intelligence-page">
      <div className="page-header">
        <h1 className="page-title">🧠 Conversation Intelligence</h1>
      </div>
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'search' ? 'tab-btn--active' : ''}`} onClick={() => setTab('search')}>🔍 Search</button>
        <button className={`tab-btn ${tab === 'timeline' ? 'tab-btn--active' : ''}`} onClick={() => setTab('timeline')}>📅 BTC Timeline</button>
      </div>
      <div className="tab-content">
        {tab === 'search' ? <SearchTab /> : <TimelineTab />}
      </div>
    </div>
  )
}
