import React, { useState } from 'react'
import CodeBlock from './CodeBlock'

function parseContent(text) {
  if (!text) return []
  const parts = []
  const regex = /```(\w*)\n?([\s\S]*?)```/g
  let last = 0, m, key = 0
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: 'text', content: text.slice(last, m.index), key: key++ })
    parts.push({ type: 'code', lang: m[1], content: m[2], key: key++ })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ type: 'text', content: text.slice(last), key: key++ })
  return parts
}

export default function MessageBubble({ message, onCopy, onRegenerate }) {
  const [showActions, setShowActions] = useState(false)
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const parts = parseContent(message.content)

  const copyMsg = async () => {
    await navigator.clipboard.writeText(message.content || '')
    onCopy?.()
  }

  return (
    <div
      className={`message-bubble ${isUser ? 'msg-user' : isAssistant ? 'msg-assistant' : 'msg-tool'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="msg-avatar">{isUser ? '👤' : isAssistant ? '🤖' : '🔧'}</div>
      <div className="msg-body">
        <div className="msg-content">
          {parts.map(p => p.type === 'code'
            ? <CodeBlock key={p.key} code={p.content} language={p.lang} />
            : <span key={p.key} className="msg-text">{p.content}</span>
          )}
          {message.streaming && <span className="streaming-cursor">▋</span>}
        </div>
        <div className="msg-meta">
          {message.timestamp && <span className="msg-time">{new Date(message.timestamp).toLocaleTimeString()}</span>}
          {message.error && <span className="msg-error-badge">error</span>}
        </div>
      </div>
      {showActions && (
        <div className="msg-actions">
          <button className="btn-icon" onClick={copyMsg} title="Copy">📋</button>
          {isAssistant && onRegenerate && (
            <button className="btn-icon" onClick={onRegenerate} title="Regenerate">🔄</button>
          )}
        </div>
      )}
    </div>
  )
}
