import React, { useState } from 'react'
import { useOllama } from '../context/OllamaContext'

const ENDPOINTS = [
  {
    id: 'chat', label: '💬 Chat', method: 'POST', path: '/api/chat',
    desc: 'Send messages to a model and get a streamed response.',
    fields: [
      { key: 'model', label: 'Model', type: 'text', placeholder: 'llama3.2' },
      { key: 'messages', label: 'Messages (JSON array)', type: 'textarea', placeholder: '[{"role":"user","content":"Hello!"}]' },
      { key: 'stream', label: 'Stream', type: 'checkbox', default: true }
    ],
    sample: { model: 'llama3.2', messages: [{ role: 'user', content: 'Hello! Who are you?' }], stream: false }
  },
  {
    id: 'generate', label: '✍️ Generate', method: 'POST', path: '/api/generate',
    desc: 'Generate a completion from a raw prompt (non-chat mode).',
    fields: [
      { key: 'model', label: 'Model', type: 'text', placeholder: 'llama3.2' },
      { key: 'prompt', label: 'Prompt', type: 'textarea', placeholder: 'Once upon a time…' },
      { key: 'stream', label: 'Stream', type: 'checkbox', default: false }
    ],
    sample: { model: 'llama3.2', prompt: 'Why is the sky blue?', stream: false }
  },
  {
    id: 'embed', label: '🔢 Embed', method: 'POST', path: '/api/embed',
    desc: 'Generate vector embeddings for text. Use with embedding models.',
    fields: [
      { key: 'model', label: 'Model', type: 'text', placeholder: 'nomic-embed-text' },
      { key: 'input', label: 'Input text', type: 'textarea', placeholder: 'The quick brown fox…' }
    ],
    sample: { model: 'nomic-embed-text', input: 'Hello world' }
  },
  {
    id: 'tags', label: '🏷️ List Models', method: 'GET', path: '/api/models',
    desc: 'List all locally installed Ollama models.',
    fields: [],
    sample: null
  },
  {
    id: 'ps', label: '⚡ Running Models', method: 'GET', path: '/api/ps',
    desc: 'List models currently loaded in memory.',
    fields: [],
    sample: null
  },
  {
    id: 'show', label: '🔍 Show Model', method: 'POST', path: '/api/show',
    desc: 'Get detailed info about a specific model including template, system prompt, and config.',
    fields: [
      { key: 'name', label: 'Model name', type: 'text', placeholder: 'llama3.2' }
    ],
    sample: { name: 'llama3.2' }
  },
  {
    id: 'version', label: '📌 Version', method: 'GET', path: '/api/ollama-version',
    desc: 'Get the running Ollama version.',
    fields: [],
    sample: null
  },
  {
    id: 'pull', label: '🔽 Pull Model', method: 'POST', path: '/api/pull',
    desc: 'Download a model from the Ollama registry.',
    fields: [
      { key: 'name', label: 'Model name', type: 'text', placeholder: 'llama3.2' },
      { key: 'stream', label: 'Stream progress', type: 'checkbox', default: true }
    ],
    sample: { name: 'llama3.2', stream: false }
  },
  {
    id: 'delete', label: '🗑️ Delete Model', method: 'POST', path: '/api/delete',
    desc: 'Delete a locally installed model.',
    fields: [
      { key: 'name', label: 'Model name', type: 'text', placeholder: 'llama3.2:1b' }
    ],
    sample: { name: 'my-old-model' }
  },
  {
    id: 'copy', label: '📋 Copy Model', method: 'POST', path: '/api/copy',
    desc: 'Create a copy of a model with a new name.',
    fields: [
      { key: 'source', label: 'Source model', type: 'text', placeholder: 'llama3.2' },
      { key: 'destination', label: 'New name', type: 'text', placeholder: 'my-llama' }
    ],
    sample: { source: 'llama3.2', destination: 'my-llama-copy' }
  },
  {
    id: 'create', label: '🛠️ Create Model', method: 'POST', path: '/api/create',
    desc: 'Create a custom model from a Modelfile.',
    fields: [
      { key: 'name', label: 'Model name', type: 'text', placeholder: 'my-custom-model' },
      { key: 'modelfile', label: 'Modelfile content', type: 'textarea', placeholder: 'FROM llama3.2\nSYSTEM You are a helpful assistant.' },
      { key: 'stream', label: 'Stream progress', type: 'checkbox', default: true }
    ],
    sample: { name: 'my-assistant', modelfile: 'FROM llama3.2\nSYSTEM You are a concise, helpful assistant.', stream: false }
  }
]

function buildCurl(ep, body) {
  if (ep.method === 'GET') {
    return `curl http://localhost:11434${ep.path === '/api/models' ? '/api/tags' : ep.path.replace('/api/', '/api/')}`
  }
  return `curl -X POST http://localhost:11434${ep.path === '/api/models' ? '/api/tags' : ep.path} \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(body, null, 2)}'`
}

function buildPowerShell(ep, body) {
  if (ep.method === 'GET') {
    return `Invoke-RestMethod "http://localhost:11434${ep.path === '/api/models' ? '/api/tags' : ep.path}"`
  }
  return `$body = '${JSON.stringify(body)}'\nInvoke-RestMethod "http://localhost:11434${ep.path === '/api/models' ? '/api/tags' : ep.path}" -Method POST -Body $body -ContentType "application/json"`
}

export default function ApiExplorer() {
  const { models } = useOllama()
  const [activeEp, setActiveEp] = useState(ENDPOINTS[0])
  const [fieldValues, setFieldValues] = useState({})
  const [rawJson, setRawJson] = useState('')
  const [useRaw, setUseRaw] = useState(false)
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const [showCurl, setShowCurl] = useState(false)
  const [copied, setCopied] = useState('')

  const selectEndpoint = (ep) => {
    setActiveEp(ep)
    setFieldValues({})
    setRawJson(ep.sample ? JSON.stringify(ep.sample, null, 2) : '')
    setResponse(null)
    setShowCurl(false)
  }

  const getBody = () => {
    if (useRaw) {
      try { return JSON.parse(rawJson) } catch { return null }
    }
    const body = {}
    for (const f of activeEp.fields) {
      const val = fieldValues[f.key]
      if (val === undefined || val === '') continue
      if (f.type === 'checkbox') { body[f.key] = val === true || val === 'true'; continue }
      if (f.type === 'textarea' && f.key === 'messages') {
        try { body[f.key] = JSON.parse(val) } catch { body[f.key] = val }
      } else { body[f.key] = val }
    }
    return body
  }

  const sendRequest = async () => {
    setLoading(true)
    setResponse(null)
    const body = activeEp.method === 'GET' ? null : getBody()
    const start = Date.now()
    try {
      const opts = { method: activeEp.method }
      if (body) { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(body) }
      const res = await fetch(activeEp.path, opts)
      const text = await res.text()
      let parsed
      try { parsed = JSON.parse(text) } catch { parsed = text }
      const duration = Date.now() - start
      const entry = { endpoint: activeEp.id, body, response: parsed, status: res.status, duration, timestamp: Date.now() }
      setResponse(entry)
      setHistory(prev => [entry, ...prev.slice(0, 19)])
    } catch (e) {
      setResponse({ error: e.message, duration: Date.now() - start })
    }
    setLoading(false)
  }

  const copy = (text, label) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  const body = getBody()

  return (
    <div className="page api-explorer-page">
      <div className="page-header">
        <h1 className="page-title">🔌 API Explorer</h1>
        <p className="page-sub">Visually test every Ollama endpoint. No code required.</p>
      </div>

      <div className="explorer-layout">
        {/* Endpoint list */}
        <div className="endpoint-list">
          <div className="endpoint-list-label">Endpoints</div>
          {ENDPOINTS.map(ep => (
            <button
              key={ep.id}
              className={`endpoint-item ${activeEp.id === ep.id ? 'endpoint-active' : ''}`}
              onClick={() => selectEndpoint(ep)}
            >
              <span className="endpoint-label">{ep.label}</span>
              <span className={`method-badge method-${ep.method.toLowerCase()}`}>{ep.method}</span>
            </button>
          ))}
        </div>

        {/* Request panel */}
        <div className="request-panel">
          <div className="request-header">
            <div>
              <div className="request-title">{activeEp.label}</div>
              <div className="request-desc">{activeEp.desc}</div>
              <code className="request-path">{activeEp.method} {activeEp.path}</code>
            </div>
          </div>

          <div className="request-tabs">
            <button className={`req-tab ${!useRaw?'req-tab-active':''}`} onClick={() => setUseRaw(false)}>Form</button>
            <button className={`req-tab ${useRaw?'req-tab-active':''}`} onClick={() => setUseRaw(true)}>Raw JSON</button>
          </div>

          {!useRaw ? (
            <div className="request-form">
              {activeEp.fields.length === 0 && (
                <div className="form-note">This endpoint takes no body. Just hit Send.</div>
              )}
              {activeEp.fields.map(f => (
                <div key={f.key} className="form-field">
                  <label className="form-label">{f.label}</label>
                  {f.type === 'checkbox' ? (
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={fieldValues[f.key] !== undefined ? fieldValues[f.key] : (f.default || false)}
                        onChange={e => setFieldValues(prev => ({ ...prev, [f.key]: e.target.checked }))}
                      />
                      <span>Enabled</span>
                    </label>
                  ) : f.type === 'textarea' ? (
                    <textarea
                      className="text-input textarea-input"
                      value={fieldValues[f.key] || ''}
                      onChange={e => setFieldValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      rows={4}
                    />
                  ) : (
                    <input
                      className="text-input"
                      value={fieldValues[f.key] || ''}
                      onChange={e => setFieldValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.key === 'model' && models[0] ? models[0].name : f.placeholder}
                      list={f.key === 'model' ? 'model-list' : undefined}
                    />
                  )}
                </div>
              ))}
              {models.length > 0 && (
                <datalist id="model-list">
                  {models.map(m => <option key={m.name} value={m.name} />)}
                </datalist>
              )}
            </div>
          ) : (
            <textarea
              className="text-input textarea-input code-textarea"
              value={rawJson}
              onChange={e => setRawJson(e.target.value)}
              rows={8}
              placeholder='{"model": "llama3.2", "messages": [...]}'
              spellCheck={false}
            />
          )}

          {activeEp.sample && (
            <button className="btn-ghost btn-sm" onClick={() => { setRawJson(JSON.stringify(activeEp.sample, null, 2)); setUseRaw(true) }}>
              📝 Load Sample
            </button>
          )}

          <div className="request-actions">
            <button className="btn-primary" onClick={sendRequest} disabled={loading}>
              {loading ? '⏳ Sending…' : '▶ Send Request'}
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setShowCurl(p => !p)}>
              {showCurl ? '▲ Hide Code' : '{ } Show Code'}
            </button>
          </div>

          {showCurl && body && (
            <div className="code-examples">
              <div className="code-example-tabs">
                <div className="code-example-section">
                  <div className="code-example-header">
                    <span>cURL</span>
                    <button className="btn-ghost btn-xs" onClick={() => copy(buildCurl(activeEp, body), 'curl')}>
                      {copied === 'curl' ? '✅ Copied!' : '📋 Copy'}
                    </button>
                  </div>
                  <pre className="code-block">{buildCurl(activeEp, body)}</pre>
                </div>
                <div className="code-example-section">
                  <div className="code-example-header">
                    <span>PowerShell</span>
                    <button className="btn-ghost btn-xs" onClick={() => copy(buildPowerShell(activeEp, body), 'ps')}>
                      {copied === 'ps' ? '✅ Copied!' : '📋 Copy'}
                    </button>
                  </div>
                  <pre className="code-block">{buildPowerShell(activeEp, body)}</pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Response panel */}
        <div className="response-panel">
          <div className="response-header">
            <span className="response-title">Response</span>
            {response && (
              <div className="response-meta">
                {response.status && <span className={`status-badge status-${response.status < 300 ? 'ok' : 'err'}`}>{response.status}</span>}
                {response.duration && <span className="duration-badge">{response.duration}ms</span>}
                <button className="btn-ghost btn-xs" onClick={() => copy(JSON.stringify(response.response, null, 2), 'resp')}>
                  {copied === 'resp' ? '✅' : '📋'}
                </button>
              </div>
            )}
          </div>

          {loading && <div className="loading-spinner">Sending request…</div>}

          {!loading && !response && (
            <div className="response-empty">
              <div className="empty-icon">🔌</div>
              <div>Select an endpoint and click Send to see the response.</div>
            </div>
          )}

          {response && (
            <pre className="code-block response-code">
              {response.error
                ? `Error: ${response.error}`
                : JSON.stringify(response.response, null, 2)
              }
            </pre>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="request-history">
              <div className="history-label">Request History</div>
              {history.map((h, i) => (
                <button key={i} className="history-item" onClick={() => setResponse(h)}>
                  <span className={`method-badge method-post`}>{h.endpoint}</span>
                  <span className="history-time">{h.duration}ms</span>
                  <span className={`status-badge status-${h.status < 300 ? 'ok' : 'err'}`}>{h.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
