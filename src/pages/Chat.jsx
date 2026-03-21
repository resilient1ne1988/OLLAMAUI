import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useOllama } from '../context/OllamaContext'
import { useOpenClaw } from '../context/OpenClawContext'
import { useToolApproval } from '../context/ToolApprovalContext'
import { useChatHistory } from '../context/ChatHistoryContext'
import { TOOL_DEFINITIONS } from '../tools/definitions'

const DEFAULT_SYSTEM_PROMPT_OLLAMA =
  'You are a helpful assistant. Answer in clear plain text unless the user explicitly asks for code. ' +
  'Refuse harmful, cheating, abusive, or clearly disallowed requests. ' +
  'Never print raw tool JSON, XML tags, or pseudo-tool syntax in your reply.'

const DEFAULT_SYSTEM_PROMPT_OPENCLAW =
  'You are a helpful assistant. Return clear, direct answers in plain text unless code is explicitly requested.'

const OLLAMA_TOOL_POLICY_ENABLED =
  'The run_shell tool is available for this turn. Use it only for benign local Windows or project tasks ' +
  'the user clearly asked you to perform on this computer. Briefly explain the plan in plain English ' +
  'before a tool call. Never mention the tool name, never show tool JSON, and never simulate a tool call in message text.'

const OLLAMA_TOOL_POLICY_DISABLED =
  'No tools are available for this turn. Do not mention, simulate, or format any tool calls.'

const RAW_TOOL_FALLBACK =
  'I can answer normally or request approval before running something on this PC, but I should not print raw tool commands or tool JSON in the chat.'

const LOCAL_CONTEXT_RE = /\b(file|folder|directory|path|terminal|powershell|command prompt|cmd|process|service|port|environment|env|variable|registry|windows|explorer|desktop|downloads|documents|localhost|server|repo|repository|project|app|git|npm|pnpm|yarn|bun|node|python|pip|package\.json|vite|electron|log|logs)\b/i
const ACTION_RE = /\b(run|execute|open|list|show|check|start|stop|restart|kill|create|rename|move|copy|delete|remove|search|find|fix|edit|debug|install|uninstall|build|test)\b/i
const WINDOWS_PATH_RE = /[A-Za-z]:\\|\/api\/|[\\/][\w.-]+\.(js|jsx|ts|tsx|py|json|md|txt|log|yml|yaml|toml|ini)\b/i
const COMMAND_HINT_RE = /(^|\n)\s*(Get-|Set-|New-|Remove-|Start-|Stop-|npm\s|node\s|python\s|py\s|git\s|cd\s|dir\s|ls\s|cat\s|type\s)/i
const ERROR_HINT_RE = /```|traceback|exception|error:|failed|stderr|stdout|stack trace|cannot find|ENOENT|ECONN/i

function parseStreamLine(line) {
  const stripped = line.startsWith('data:') ? line.slice(5).trim() : line.trim()
  if (!stripped || stripped === '[DONE]') return null
  return JSON.parse(stripped)
}

function tryParseObject(text) {
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function unwrapSingleCodeFence(text) {
  const match = text.trim().match(/^```(?:json|javascript|js|text)?\s*([\s\S]*?)```$/i)
  return match ? match[1].trim() : text.trim()
}

function isRawRunShellPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  if (value.name === 'run_shell') return true
  if (value.function?.name === 'run_shell') return true
  return false
}

function isToolLeakText(text) {
  const unwrapped = unwrapSingleCodeFence(text)
  if (!unwrapped) return false
  if (/^\s*run_shell\b/i.test(unwrapped)) return true
  return isRawRunShellPayload(tryParseObject(unwrapped))
}

function sanitizeAssistantContent(content, toolCalls, provider) {
  if (provider !== 'ollama' || !content || toolCalls.length > 0) return content

  let next = content.replace(/```(?:json|javascript|js|text)?\s*([\s\S]*?)```/gi, (match, inner) => {
    return isToolLeakText(inner) ? '' : match
  })

  next = next
    .split(/\r?\n/)
    .filter(line => !/^\s*run_shell\b/i.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!next && isToolLeakText(content)) return RAW_TOOL_FALLBACK
  if (isToolLeakText(next)) return RAW_TOOL_FALLBACK
  return next
}

function shouldOfferShellTools(uiMessages) {
  const recentUserText = uiMessages
    .filter(m => m.role === 'user')
    .slice(-4)
    .map(m => m.content || '')
    .join('\n')

  if (!recentUserText.trim()) return false
  if (WINDOWS_PATH_RE.test(recentUserText)) return true
  if (COMMAND_HINT_RE.test(recentUserText)) return true
  if (/on this (computer|pc|machine)|in this (project|repo|app)/i.test(recentUserText)) return true
  if (LOCAL_CONTEXT_RE.test(recentUserText) && ACTION_RE.test(recentUserText)) return true
  if (ERROR_HINT_RE.test(recentUserText) && ACTION_RE.test(recentUserText)) return true
  return false
}

function normalizeToolCall(tc) {
  const name = tc?.function?.name || tc?.name || ''
  let args = tc?.function?.arguments ?? tc?.function?.parameters ?? tc?.arguments ?? tc?.parameters ?? {}

  if (typeof args === 'string') {
    const parsed = tryParseObject(args)
    args = parsed || { command: args }
  }

  if (name !== 'run_shell') {
    return { valid: false, name: name || 'unknown_tool', args: {}, output: `Blocked unsupported tool "${name || 'unknown_tool'}".` }
  }

  const command = typeof args?.command === 'string' ? args.command.trim() : ''
  if (!command) {
    return { valid: false, name, args: {}, output: 'Blocked malformed shell tool call with no command.' }
  }

  return { valid: true, name, args: { command } }
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
        {isPending && <span className="tool-spinner">&#x23F3;</span>}
        {isApproved && <span>&#x2705;</span>}
        {isRejected && <span>&#x1F6AB;</span>}
        <span className="tool-call-name">{msg.toolName}()</span>
        <span className="tool-call-status">
          {isPending ? 'Awaiting approval in Approval Center&#x2026;' :
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

/** Derive a human-readable session title from messages */
function deriveTitle(msgs) {
  const userMsgs = msgs.filter(m => m.role === 'user' && m.content?.trim())
  if (!userMsgs.length) return 'Untitled Chat'
  const last = userMsgs[userMsgs.length - 1].content.trim()
  return last.length > 72 ? last.slice(0, 69) + '...' : last
}

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now - d
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/** Group sessions by model name */
function groupByModel(sessions) {
  const groups = {}
  for (const s of sessions) {
    const key = s.model || 'Unknown Model'
    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  }
  return groups
}

export default function Chat() {
  const { selectedModel, setSelectedModel, models } = useOllama()
  const { provider, selectedAgent, setSelectedAgent, setProvider } = useOpenClaw()
  const { requestApproval } = useToolApproval()
  const { sessions, loaded, loadSessions, saveSession, deleteSession } = useChatHistory()

  const [activeTab, setActiveTab] = useState('chat') // 'chat' | 'history'
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isAwaitingApproval, setIsAwaitingApproval] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT_OLLAMA)
  const [showSystemPrompt, setShowSystemPrompt] = useState(false)
  const [sessionId, setSessionId] = useState(() => `session-${Date.now()}`)
  const [expandedModels, setExpandedModels] = useState({})

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const abortControllerRef = useRef(null)
  const saveTimeoutRef = useRef(null)

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

  // Load history when History tab is opened
  useEffect(() => {
    if (activeTab === 'history' && !loaded) {
      loadSessions()
    }
  }, [activeTab, loaded, loadSessions])

  // Expand all model groups initially when sessions load
  useEffect(() => {
    if (loaded && sessions.length > 0) {
      const groups = groupByModel(sessions)
      setExpandedModels(prev => {
        const next = { ...prev }
        Object.keys(groups).forEach(k => { if (!(k in next)) next[k] = true })
        return next
      })
    }
  }, [loaded, sessions])

  // Auto-save session after a completed turn
  const persistSession = useCallback((msgs, sysPr, prov, mod) => {
    if (!msgs.length) return
    const userMsgs = msgs.filter(m => m.role === 'user')
    if (!userMsgs.length) return
    const title = deriveTitle(msgs)
    const sessionData = {
      id: sessionId,
      title,
      model: mod,
      provider: prov,
      messages: msgs,
      systemPrompt: sysPr,
      createdAt: msgs[0]?.timestamp || Date.now(),
      updatedAt: Date.now()
    }
    clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => saveSession(sessionData), 500)
  }, [sessionId, saveSession])

  const buildApiMessages = useCallback((uiMessages, toolsEnabled) => {
    const runtimeSystemPrompt = provider === 'ollama'
      ? [systemPrompt, toolsEnabled ? OLLAMA_TOOL_POLICY_ENABLED : OLLAMA_TOOL_POLICY_DISABLED].join('\n\n')
      : systemPrompt

    const apiMsgs = [{ role: 'system', content: runtimeSystemPrompt }]
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
    }
    return apiMsgs
  }, [systemPrompt, provider])

  const streamRound = useCallback(async (apiMessages, toolsEnabled) => {
    const targetModel = provider === 'openclaw' ? selectedAgent : selectedModel
    const controller = new AbortController()
    abortControllerRef.current = controller

    const endpoint = provider === 'openclaw' ? '/api/openclaw/chat' : '/api/chat'
    const payload = provider === 'openclaw'
      ? { agentId: targetModel, messages: apiMessages, stream: true }
      : {
          model: targetModel,
          messages: apiMessages,
          ...(toolsEnabled ? { tools: TOOL_DEFINITIONS } : {}),
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
            streamRound._onChunk?.(sanitizeAssistantContent(fullContent, toolCalls, provider))
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
            streamRound._onChunk?.(sanitizeAssistantContent(fullContent, toolCalls, provider))
          }
          if (provider === 'ollama' && json.message?.tool_calls?.length) {
            toolCalls = [...toolCalls, ...json.message.tool_calls]
          }
        }
      } catch {}
    }

    return { content: fullContent, toolCalls }
  }, [provider, selectedAgent, selectedModel])

  const performChat = useCallback(async (uiMessages) => {
    const toolsEnabled = provider === 'ollama' && shouldOfferShellTools(uiMessages)
    const apiMessages = buildApiMessages(uiMessages, toolsEnabled)

    const assistantId = `asst-${Date.now()}`
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      toolCalls: [],
      timestamp: Date.now()
    }])

    streamRound._onChunk = (fullContent) => {
      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m)
      )
    }

    let content, toolCalls
    try {
      ;({ content, toolCalls } = await streamRound(apiMessages, toolsEnabled))
    } finally {
      streamRound._onChunk = null
    }

    const safeContent = sanitizeAssistantContent(content, toolCalls, provider)

    setMessages(prev =>
      prev.map(m => m.id === assistantId ? { ...m, content: safeContent, toolCalls } : m)
    )

    if (provider === 'openclaw' || toolCalls.length === 0) {
      const finalMsgs = [...uiMessages, { role: 'assistant', content: safeContent, toolCalls: [], id: assistantId, timestamp: Date.now() }]
      const currentModel = provider === 'openclaw' ? selectedAgent : selectedModel
      persistSession(finalMsgs, systemPrompt, provider, currentModel)
      return finalMsgs
    }

    setIsStreaming(false)
    setIsAwaitingApproval(true)

    const toolResultMessages = []

    for (const tc of toolCalls) {
      const normalizedCall = normalizeToolCall(tc)
      const callUiId = `tc-ui-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`

      if (!normalizedCall.valid) {
        setMessages(prev => [...prev, {
          id: callUiId,
          role: 'tool_call_ui',
          toolName: normalizedCall.name,
          args: normalizedCall.args,
          status: 'done',
          approved: false,
          output: normalizedCall.output,
          timestamp: Date.now()
        }])

        toolResultMessages.push({
          id: `tool-result-${callUiId}`,
          role: 'tool_result',
          toolName: normalizedCall.name,
          args: normalizedCall.args,
          approved: false,
          output: normalizedCall.output,
          timestamp: Date.now()
        })
        continue
      }

      setMessages(prev => [...prev, {
        id: callUiId,
        role: 'tool_call_ui',
        toolName: normalizedCall.name,
        args: normalizedCall.args,
        status: 'pending',
        approved: null,
        output: null,
        timestamp: Date.now()
      }])

      const { approved, output } = await requestApproval(normalizedCall.name, normalizedCall.args)

      setMessages(prev =>
        prev.map(m => m.id === callUiId ? { ...m, status: 'done', approved, output } : m)
      )

      toolResultMessages.push({
        id: `tool-result-${callUiId}`,
        role: 'tool_result',
        toolName: normalizedCall.name,
        args: normalizedCall.args,
        approved,
        output,
        timestamp: Date.now()
      })
    }

    setIsAwaitingApproval(false)
    setIsStreaming(true)

    const updatedMessages = [
      ...uiMessages,
      { role: 'assistant', content: safeContent, toolCalls, id: assistantId, timestamp: Date.now() },
      ...toolResultMessages
    ]

    return performChat(updatedMessages)
  }, [buildApiMessages, streamRound, requestApproval, provider, selectedAgent, selectedModel, systemPrompt, persistSession])

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
              content: updated[lastIdx].content || `Error: ${e.message}`,
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

  const startNewChat = () => {
    setMessages([])
    setInput('')
    setSessionId(`session-${Date.now()}`)
    setActiveTab('chat')
    inputRef.current?.focus()
  }

  const loadSessionIntoChat = (session) => {
    setMessages(session.messages || [])
    setSystemPrompt(session.systemPrompt || DEFAULT_SYSTEM_PROMPT_OLLAMA)
    setSessionId(session.id)

    if (session.provider === 'openclaw') {
      setProvider('openclaw')
      if (session.model) setSelectedAgent(session.model)
    } else {
      setProvider('ollama')
      if (session.model) setSelectedModel(session.model)
    }

    setActiveTab('chat')
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const handleDeleteSession = async (e, id) => {
    e.stopPropagation()
    await deleteSession(id)
  }

  const toggleModelGroup = (modelKey) => {
    setExpandedModels(prev => ({ ...prev, [modelKey]: !prev[modelKey] }))
  }

  const isBusy = isStreaming || isAwaitingApproval
  const targetModel = provider === 'openclaw' ? selectedAgent : selectedModel
  const showToolUi = provider === 'ollama'
  const grouped = groupByModel(sessions)
  const modelKeys = Object.keys(grouped).sort()

  return (
    <div className="chat-page">
      {/* Tab bar */}
      <div className="chat-tabs">
        <button
          className={`chat-tab ${activeTab === 'chat' ? 'chat-tab-active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          &#x1F4AC; Chat
        </button>
        <button
          className={`chat-tab ${activeTab === 'history' ? 'chat-tab-active' : ''}`}
          onClick={() => { setActiveTab('history'); if (!loaded) loadSessions() }}
        >
          &#x1F4CB; History {sessions.length > 0 && <span className="history-badge">{sessions.length}</span>}
        </button>
        <button className="chat-tab-new-btn" onClick={startNewChat} title="Start a new chat">
          &#x2795; New Chat
        </button>
      </div>

      {/* ── CHAT TAB ── */}
      {activeTab === 'chat' && (
        <div className="chat-container">
          <div className="system-prompt-bar">
            <button className="btn-ghost btn-sm" onClick={() => setShowSystemPrompt(p => !p)}>
              {showSystemPrompt ? '&#x25B2;' : '&#x25BC;'} System Prompt
            </button>
            <button className="btn-ghost btn-sm" onClick={startNewChat} title="Clear chat and start fresh">
              &#x1F5D1; Clear
            </button>
            {showToolUi && isAwaitingApproval && (
              <span className="awaiting-label">&#x23F3; Waiting for tool approval&#x2026;</span>
            )}
          </div>

          {showSystemPrompt && (
            <div className="system-prompt-editor">
              <textarea
                className="system-prompt-input"
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                rows={3}
                placeholder="System prompt&#x2026;"
              />
            </div>
          )}

          <div className="messages">
            {messages.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">&#x1F999;</div>
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
              if (msg.role === 'tool_result') return null

              const isUser = msg.role === 'user'
              const isLast = idx === messages.length - 1
              return (
                <div key={msg.id || idx} className={`message-row ${isUser ? 'message-user' : 'message-assistant'}`}>
                  <div className={`message-bubble ${isUser ? 'bubble-user' : 'bubble-assistant'} ${msg.error ? 'bubble-error' : ''}`}>
                    <div className="message-role">
                      {isUser ? '&#x1F464; You' : '&#x1F999; Assistant'}
                    </div>
                    <div className="message-content">
                      {renderMessageContent(msg.content)}
                      {isLast && isStreaming && !isUser && (
                        <span className="cursor-blink">&#x2587;</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="input-area">
            <textarea
              ref={inputRef}
              className="chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                !targetModel ? 'Select a model/agent to start chatting...' :
                (showToolUi && isAwaitingApproval) ? 'Waiting for tool approval in Approval Center...' :
                isStreaming ? 'Waiting for response...' :
                'Type a message... (Enter to send, Shift+Enter for newline)'
              }
              disabled={isBusy || !targetModel}
              rows={3}
            />
            <div className="input-actions">
              {isBusy ? (
                <button className="btn-danger" onClick={stopStreaming}>&#x23F9; Stop</button>
              ) : (
                <button
                  className="btn-primary"
                  onClick={sendMessage}
                  disabled={!input.trim() || !targetModel}
                >
                  Send &#x27A4;
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        <div className="history-panel">
          <div className="history-header">
            <span className="history-header-title">&#x1F4CB; Chat History</span>
            <button className="btn-primary btn-sm" onClick={startNewChat}>&#x2795; New Chat</button>
          </div>

          {!loaded && (
            <div className="history-loading">Loading sessions&#x2026;</div>
          )}

          {loaded && sessions.length === 0 && (
            <div className="history-empty">
              <div style={{ fontSize: 40, marginBottom: 12 }}>&#x1F4AC;</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>No chat history yet</div>
              <div style={{ color: '#8b949e', fontSize: 14 }}>Your conversations will be saved here automatically.</div>
            </div>
          )}

          {loaded && modelKeys.map(modelKey => (
            <div key={modelKey} className="history-model-group">
              <button
                className="history-model-header"
                onClick={() => toggleModelGroup(modelKey)}
              >
                <span className="history-model-icon">&#x1F916;</span>
                <span className="history-model-name">{modelKey}</span>
                <span className="history-model-count">{grouped[modelKey].length} chat{grouped[modelKey].length !== 1 ? 's' : ''}</span>
                <span className="history-model-chevron">{expandedModels[modelKey] ? '&#x25B2;' : '&#x25BC;'}</span>
              </button>

              {expandedModels[modelKey] && (
                <div className="history-session-list">
                  {grouped[modelKey]
                    .slice()
                    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
                    .map(session => {
                      const msgCount = (session.messages || []).filter(m => m.role === 'user' || m.role === 'assistant').length
                      return (
                        <div
                          key={session.id}
                          className={`history-session-item ${session.id === sessionId ? 'history-session-active' : ''}`}
                          onClick={() => loadSessionIntoChat(session)}
                          title="Click to load this conversation"
                        >
                          <div className="history-session-title">{session.title || 'Untitled Chat'}</div>
                          <div className="history-session-meta">
                            <span className="history-session-date">{formatDate(session.updatedAt)}</span>
                            <span className="history-session-msgs">{msgCount} message{msgCount !== 1 ? 's' : ''}</span>
                          </div>
                          <button
                            className="history-session-delete"
                            onClick={(e) => handleDeleteSession(e, session.id)}
                            title="Delete this session"
                          >
                            &#x1F5D1;
                          </button>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
