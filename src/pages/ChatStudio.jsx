import React, { useState, useEffect, useRef, useContext } from 'react'
import { AppContext } from '../App'
import { useChat } from '../hooks/useChat'
import MessageBubble from '../components/MessageBubble'

export default function ChatStudio() {
  const { provider, selectedModel, settings, toast } = useContext(AppContext)
  const [sessions, setSessions] = useState([])
  const [showParams, setShowParams] = useState(false)
  const [params, setParams] = useState({ temperature: 0.7, top_p: 0.9, top_k: 40, num_predict: 2048, num_ctx: 4096, seed: 0, system: '' })
  const [input, setInput] = useState('')
  const [pendingShell, setPendingShell] = useState(null)
  const [sessionName, setSessionName] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const { messages, isStreaming, sendMessage, stopStreaming, clearChat, loadSession, saveSession, setMessages } = useChat({
    provider, selectedModel, settings,
    onShellRequest: (cmd) => setPendingShell(cmd)
  })

  useEffect(() => {
    fetch('/api/sessions').then(r => r.json()).then(d => setSessions(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || isStreaming) return
    const options = {}
    if (params.temperature) options.temperature = params.temperature
    if (params.top_p) options.top_p = params.top_p
    if (params.top_k) options.top_k = params.top_k
    if (params.num_predict) options.num_predict = params.num_predict
    if (params.num_ctx) options.num_ctx = params.num_ctx
    if (params.system) options.system = params.system
    sendMessage(input, options)
    setInput('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
    if (e.key === 'Escape') stopStreaming()
  }

  const handleSave = async () => {
    const session = await saveSession(sessionName || 'Chat ' + new Date().toLocaleString())
    if (session) {
      toast('success', 'Session saved')
      setSessions(prev => [session, ...prev.filter(s => s.id !== session.id)])
    }
  }

  const handleLoadSession = (session) => {
    loadSession(session)
    setSessionName(session.name)
  }

  const executeShell = async (cmd) => {
    setPendingShell(null)
    try {
      const res = await fetch('/api/shell', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: cmd }) })
      const data = await res.json()
      const output = data.stdout || data.stderr || '(no output)'
      setMessages(prev => [...prev, { role: 'tool', content: `$ ${cmd}\n${output}`, timestamp: Date.now() }])
    } catch (e) {
      toast('error', 'Shell error: ' + e.message)
    }
  }

  const exportMD = () => {
    const lines = [`# ${sessionName || 'Chat Export'}`, `*${new Date().toLocaleString()}*`, '']
    messages.forEach(m => { lines.push(`## ${m.role}`); lines.push(m.content || ''); lines.push('') })
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'chat.md'; a.click()
  }

  return (
    <div className="page chat-page">
      <div className="chat-sessions-panel">
        <div className="panel-header">
          <h3>💬 Sessions</h3>
          <button className="btn-sm btn-primary" onClick={() => { clearChat(); setSessionName('') }}>+ New</button>
        </div>
        <div className="sessions-list">
          {sessions.map(s => (
            <div key={s.id} className="session-row" onClick={() => handleLoadSession(s)}>
              <span className="session-name">{s.name}</span>
              <span className="session-meta text-secondary">{s.model || ''}</span>
            </div>
          ))}
          {sessions.length === 0 && <p className="text-secondary text-sm">No saved sessions</p>}
        </div>
      </div>

      <div className="chat-main">
        <div className="chat-toolbar">
          <input
            className="session-name-input"
            value={sessionName}
            onChange={e => setSessionName(e.target.value)}
            placeholder="Session name..."
          />
          <button className="btn-sm btn-ghost" onClick={handleSave}>💾 Save</button>
          <button className="btn-sm btn-ghost" onClick={exportMD}>⬇ Export</button>
          <button className="btn-sm btn-ghost" onClick={clearChat}>🗑 Clear</button>
          <button className="btn-sm btn-ghost" onClick={() => setShowParams(!showParams)}>⚙ Params</button>
        </div>

        {!selectedModel && (
          <div className="empty-state">
            <p>⚠️ Select a model from the top bar to start chatting.</p>
          </div>
        )}

        {pendingShell && (
          <div className="shell-approval-banner">
            <span>🔧 Model wants to run: <code>{pendingShell}</code></span>
            <button className="btn-sm btn-primary" onClick={() => executeShell(pendingShell)}>✅ Allow</button>
            <button className="btn-sm btn-danger" onClick={() => setPendingShell(null)}>❌ Deny</button>
          </div>
        )}

        <div className="messages-area">
          {messages.length === 0 && (
            <div className="chat-welcome">
              <p className="text-secondary">Start a conversation with {selectedModel ? selectedModel.replace(/:latest$/, '') : 'your AI model'}.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <MessageBubble
              key={i}
              message={m}
              onCopy={() => toast('success', 'Copied')}
              onRegenerate={i === messages.length - 1 && m.role === 'assistant' ? () => {} : undefined}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Streaming... (Esc to stop)' : 'Type a message... (Enter to send, Shift+Enter for newline)'}
            disabled={isStreaming}
            rows={3}
          />
          <div className="chat-input-actions">
            {isStreaming
              ? <button className="btn-danger" onClick={stopStreaming}>⏹ Stop</button>
              : <button className="btn-primary" onClick={handleSend} disabled={!input.trim() || !selectedModel}>➤ Send</button>
            }
          </div>
        </div>
      </div>

      {showParams && (
        <div className="chat-params-panel">
          <h3>⚙ Parameters</h3>
          <div className="param-group">
            <label>System Prompt</label>
            <textarea className="param-textarea" value={params.system} onChange={e => setParams(p => ({ ...p, system: e.target.value }))} placeholder="You are a helpful assistant..." rows={4} />
          </div>
          <div className="param-group">
            <label>Temperature: {params.temperature}</label>
            <input type="range" min="0" max="2" step="0.1" value={params.temperature} onChange={e => setParams(p => ({ ...p, temperature: parseFloat(e.target.value) }))} />
          </div>
          <div className="param-group">
            <label>Top P: {params.top_p}</label>
            <input type="range" min="0" max="1" step="0.05" value={params.top_p} onChange={e => setParams(p => ({ ...p, top_p: parseFloat(e.target.value) }))} />
          </div>
          <div className="param-group">
            <label>Top K: {params.top_k}</label>
            <input type="range" min="1" max="100" step="1" value={params.top_k} onChange={e => setParams(p => ({ ...p, top_k: parseInt(e.target.value) }))} />
          </div>
          <div className="param-group">
            <label>Max Tokens: {params.num_predict}</label>
            <input type="range" min="128" max="8192" step="128" value={params.num_predict} onChange={e => setParams(p => ({ ...p, num_predict: parseInt(e.target.value) }))} />
          </div>
          <div className="param-group">
            <label>Context: {params.num_ctx}</label>
            <input type="range" min="512" max="32768" step="512" value={params.num_ctx} onChange={e => setParams(p => ({ ...p, num_ctx: parseInt(e.target.value) }))} />
          </div>
        </div>
      )}
    </div>
  )
}
