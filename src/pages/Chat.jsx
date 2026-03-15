import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useOllama } from '../context/OllamaContext'
import { useOpenClaw } from '../context/OpenClawContext'
import { useToolApproval } from '../context/ToolApprovalContext'
import { TOOL_DEFINITIONS } from '../tools/definitions'

const DEFAULT_SYSTEM_PROMPT_OLLAMA =
  'You are a helpful assistant with access to run shell commands on this Windows machine. ' +
  'When you need to execute a command, use the run_shell tool. ' +
  'Always explain what you are about to do before calling a tool.'

const DEFAULT_SYSTEM_PROMPT_OPENCLAW =
  'You are a helpful assistant. Return clear, direct answers in plain text unless code is explicitly requested.'

function parseStreamLine(line) {
  const stripped = line.startsWith('data:') ? line.slice(5).trim() : line.trim()
  if (!stripped || stripped === '[DONE]') return null
  return JSON.parse(stripped)
}

function renderMessageContent(text) {
  if (!text) return null
  const parts = []
  let key = 0
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let m
  while ((m = codeBlockRegex.exec(text)) !== null) {
    if (m.index > lastIndex) {
      parts.push(
        <span key={key++} style={{ whiteSpace: 'pre-wrap' }}>
          {text.slice(lastIndex, m.index)}
        </span>
      )
    }
    parts.push(
      <pre key={key++} className="code-block">
        <code>{m[2]}</code>
      </pre>
    )
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < text.length) {
    parts.push(
      <span key={key++} style={{ whiteSpace: 'pre-wrap' }}>
        {text.slice(lastIndex)}
      </span>
    )
  }
  return parts.length > 0 ? parts : <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>
}

function ToolCallBubble({ msg }) {
  const isApproved = msg.approved === true
  const isRejected = msg.approved === false
  const isPending = msg.status === 'pending'

  return (
    <div className={`tool-call-bubble ${isPending ? 'tool-pending' : isApproved ? 'tool-approved' : 'tool-rejected'}`}>
      <div className="tool-call-header">
        {isPending && <span className="tool-spinner">⏳</span>}
        {isApproved && <span>✅</span>}
        {isRejected && <span>🚫</span>}
        <span className="tool-call-name">{msg.toolName}()</span>
        <span className="tool-call-status">
          {isPending ? 'Awaiting approval in Approval Center…' :
           isApproved ? 'Executed' : 'Rejected'}
        </span>
      </div>
      <pre className="tool-call-args">{JSON.stringify(msg.args, null, 2)}</pre>
      {isApproved && msg.output && (
        <pre className="tool-call-output">{msg.output}</pre>
      )}
    </div>
  )
}

export default function Chat() {
  const { selectedModel } = useOllama()
  const { provider, selectedAgent } = useOpenClaw()
  const { requestApproval } = useToolApproval()

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isAwaitingApproval, setIsAwaitingApproval] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT_OLLAMA)
  const [showSystemPrompt, setShowSystemPrompt] = useState(false)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const abortControllerRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setSystemPrompt(prev => {
      if (provider === 'openclaw' && prev === DEFAULT_SYSTEM_PROMPT_OLLAMA) return DEFAULT_SYSTEM_PROMPT_OPENCLAW
      if (provider === 'ollama' && prev === DEFAULT_SYSTEM_PROMPT_OPENCLAW) return DEFAULT_SYSTEM_PROMPT_OLLAMA
      return prev
    })
  }, [provider])

  // Convert UI messages to Ollama API format, collapsing tool results properly
  const buildApiMessages = useCallback((uiMessages) => {
    const apiMsgs = [{ role: 'system', content: systemPrompt }]
    for (const m of uiMessages) {
      if (m.role === 'user') {
        apiMsgs.push({ role: 'user', content: m.content })
      } else if (m.role === 'assistant') {
        const msg = { role: 'assistant', content: m.content || '' }
        if (m.toolCalls?.length) msg.tool_calls = m.toolCalls
        apiMsgs.push(msg)
      } else if (m.role === 'tool_result') {
        apiMsgs.push({ role: 'tool', content: m.output })
      }
      // 'tool_call_ui' messages are display-only, not sent to model
    }
    return apiMsgs
  }, [systemPrompt])

  // Stream one round-trip to active provider. Returns { content, toolCalls }.
  const streamRound = useCallback(async (apiMessages) => {
    const targetModel = provider === 'openclaw' ? selectedAgent : selectedModel
    const controller = new AbortController()
    abortControllerRef.current = controller

    const endpoint = provider === 'openclaw' ? '/api/openclaw/chat' : '/api/chat'
    const payload = provider === 'openclaw'
      ? {
          agentId: targetModel,
          messages: apiMessages,
          stream: true
        }
      : {
          model: targetModel,
          messages: apiMessages,
          tools: TOOL_DEFINITIONS,
          stream: true
        }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (!res.body) throw new Error('No response body from provider')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let fullContent = ''
    let toolCalls = []
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()

      for (const line of lines) {
        try {
          const json = parseStreamLine(line)
          if (!json) continue

          const chunk = provider === 'openclaw'
            ? (json.choices?.[0]?.delta?.content || json.choices?.[0]?.message?.content || '')
            : (json.message?.content || json.response || '')

          if (chunk) {
            fullContent += chunk
            // Yield content to caller via callback — we update state externally
            streamRound._onChunk?.(fullContent)
          }

          if (provider === 'ollama' && json.message?.tool_calls?.length) {
            toolCalls = [...toolCalls, ...json.message.tool_calls]
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    if (buffer.trim()) {
      try {
        const json = parseStreamLine(buffer)
        if (json) {
          const chunk = provider === 'openclaw'
            ? (json.choices?.[0]?.delta?.content || json.choices?.[0]?.message?.content || '')
            : (json.message?.content || json.response || '')
          if (chunk) {
            fullContent += chunk
            streamRound._onChunk?.(fullContent)
          }
          if (provider === 'ollama' && json.message?.tool_calls?.length) {
            toolCalls = [...toolCalls, ...json.message.tool_calls]
          }
        }
      } catch {
        // ignore trailing partial buffer
      }
    }

    return { content: fullContent, toolCalls }
  }, [provider, selectedAgent, selectedModel])

  // Full conversation turn: stream → handle tool calls → stream again if needed
  const performChat = useCallback(async (uiMessages) => {
    const apiMessages = buildApiMessages(uiMessages)

    // Placeholder assistant bubble for streaming
    const assistantId = `asst-${Date.now()}`
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      toolCalls: [],
      timestamp: Date.now()
    }])

    // Wire streaming chunks to update the assistant bubble
    streamRound._onChunk = (fullContent) => {
      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m)
      )
    }

    let content, toolCalls
    try {
      ;({ content, toolCalls } = await streamRound(apiMessages))
    } finally {
      streamRound._onChunk = null
    }

    // Finalize the assistant message (with tool_calls metadata for API continuity)
    setMessages(prev =>
      prev.map(m => m.id === assistantId ? { ...m, content, toolCalls } : m)
    )

    if (provider === 'openclaw' || toolCalls.length === 0) {
      // Normal text response — done
      return [...uiMessages, { role: 'assistant', content, toolCalls: [], id: assistantId, timestamp: Date.now() }]
    }

    // ── Native tool call path ────────────────────────────────────────────────
    setIsStreaming(false)
    setIsAwaitingApproval(true)

    const toolResultMessages = []

    for (const tc of toolCalls) {
      const { name, arguments: args } = tc.function
      const callUiId = `tc-ui-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`

      // Show inline pending card in chat
      setMessages(prev => [...prev, {
        id: callUiId,
        role: 'tool_call_ui',
        toolName: name,
        args,
        status: 'pending',
        approved: null,
        output: null,
        timestamp: Date.now()
      }])

      // Block until user approves or rejects in Approval Center
      const { approved, output } = await requestApproval(name, args)

      // Update inline card
      setMessages(prev =>
        prev.map(m => m.id === callUiId ? { ...m, status: 'done', approved, output } : m)
      )

      toolResultMessages.push({
        id: `tool-result-${callUiId}`,
        role: 'tool_result',
        toolName: name,
        args,
        approved,
        output,
        timestamp: Date.now()
      })
    }

    setIsAwaitingApproval(false)
    setIsStreaming(true)

    const updatedMessages = [
      ...uiMessages,
      { role: 'assistant', content, toolCalls, id: assistantId, timestamp: Date.now() },
      ...toolResultMessages
    ]

    // Recurse: send tool results back to model for final response
    return performChat(updatedMessages)
  }, [buildApiMessages, streamRound, requestApproval, provider])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    const targetModel = provider === 'openclaw' ? selectedAgent : selectedModel
    if (!text || isStreaming || isAwaitingApproval || !targetModel) return

    const userMsg = { role: 'user', content: text, timestamp: Date.now() }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setIsStreaming(true)

    try {
      await performChat(nextMessages)
    } catch (e) {
      if (e.name !== 'AbortError') {
        setMessages(prev => {
          const updated = [...prev]
          const lastIdx = updated.length - 1
          if (updated[lastIdx]?.role === 'assistant') {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: updated[lastIdx].content || `❌ Error: ${e.message}`,
              error: true
            }
          }
          return updated
        })
      }
    } finally {
      setIsStreaming(false)
      setIsAwaitingApproval(false)
    }
  }, [input, isStreaming, isAwaitingApproval, selectedModel, selectedAgent, provider, messages, performChat])

  const stopStreaming = () => {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
    setIsAwaitingApproval(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => setMessages([])

  const isBusy = isStreaming || isAwaitingApproval
  const targetModel = provider === 'openclaw' ? selectedAgent : selectedModel
  const showToolUi = provider === 'ollama'

  return (
    <div className="chat-container">
      {/* System prompt bar */}
      <div className="system-prompt-bar">
        <button className="btn-ghost btn-sm" onClick={() => setShowSystemPrompt(p => !p)}>
          {showSystemPrompt ? '▲' : '▼'} System Prompt
        </button>
        <button className="btn-ghost btn-sm" onClick={clearChat} title="Clear chat history">
          🗑 Clear
        </button>
        {showToolUi && isAwaitingApproval && (
          <span className="awaiting-label">⏳ Waiting for tool approval…</span>
        )}
      </div>

      {showSystemPrompt && (
        <div className="system-prompt-editor">
          <textarea
            className="system-prompt-input"
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            rows={3}
            placeholder="System prompt…"
          />
        </div>
      )}

      {/* Messages */}
      <div className="messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🦙</div>
            <div className="empty-title">Start a conversation</div>
            <div className="empty-sub">
              {showToolUi
                ? 'Tool calls will appear in the Approval Center before any command runs.'
                : 'OpenClaw responses stream directly from your selected agent.'}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          if (showToolUi && msg.role === 'tool_call_ui') {
            return (
              <div key={msg.id || idx} className="message-row message-tool">
                <ToolCallBubble msg={msg} />
              </div>
            )
          }
          if (msg.role === 'tool_result') {
            return null // shown inline via tool_call_ui
          }

          const isUser = msg.role === 'user'
          const isLast = idx === messages.length - 1
          return (
            <div key={msg.id || idx} className={`message-row ${isUser ? 'message-user' : 'message-assistant'}`}>
              <div className={`message-bubble ${isUser ? 'bubble-user' : 'bubble-assistant'} ${msg.error ? 'bubble-error' : ''}`}>
                <div className="message-role">
                  {isUser ? '👤 You' : '🦙 Assistant'}
                </div>
                <div className="message-content">
                  {renderMessageContent(msg.content)}
                  {isLast && isStreaming && !isUser && (
                    <span className="cursor-blink">▋</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="input-area">
        <textarea
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            !targetModel ? 'Select a model/agent to start chatting…' :
            (showToolUi && isAwaitingApproval) ? 'Waiting for tool approval in Approval Center…' :
            isStreaming ? 'Waiting for response…' :
            'Type a message… (Enter to send, Shift+Enter for newline)'
          }
          disabled={isBusy || !targetModel}
          rows={3}
        />
        <div className="input-actions">
          {isBusy ? (
            <button className="btn-danger" onClick={stopStreaming}>⏹ Stop</button>
          ) : (
            <button
              className="btn-primary"
              onClick={sendMessage}
              disabled={!input.trim() || !targetModel}
            >
              Send ➤
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
