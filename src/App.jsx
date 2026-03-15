import React, { useState, useEffect, useRef, useCallback } from 'react'

const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful assistant with access to run shell commands on this Windows machine when asked. ' +
  'When the user asks you to run a command, respond with the command wrapped in a <shell> tag, e.g. <shell>dir C:\\</shell>. ' +
  'The system will automatically execute it and return the output to you.'

function parseShellCommands(text) {
  const regex = /<shell>([\s\S]*?)<\/shell>/g
  const commands = []
  let match
  while ((match = regex.exec(text)) !== null) {
    commands.push(match[1].trim())
  }
  return commands
}

function renderMessageContent(text) {
  // Render code blocks and shell tags with syntax highlighting style
  const parts = []
  let remaining = text
  let key = 0

  // Replace <shell>...</shell> blocks
  remaining = remaining.replace(/<shell>([\s\S]*?)<\/shell>/g, (_, cmd) => {
    return `\`\`\`shell\n${cmd}\n\`\`\``
  })

  // Split on code blocks
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let m
  while ((m = codeBlockRegex.exec(remaining)) !== null) {
    if (m.index > lastIndex) {
      parts.push(
        <span key={key++} style={{ whiteSpace: 'pre-wrap' }}>
          {remaining.slice(lastIndex, m.index)}
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
  if (lastIndex < remaining.length) {
    parts.push(
      <span key={key++} style={{ whiteSpace: 'pre-wrap' }}>
        {remaining.slice(lastIndex)}
      </span>
    )
  }
  return parts.length > 0 ? parts : <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>
}

export default function App() {
  const [messages, setMessages] = useState([])
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState('')
  const [connected, setConnected] = useState(null) // null=checking, true, false
  const [activeTab, setActiveTab] = useState('chat')
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT)
  const [showSystemPrompt, setShowSystemPrompt] = useState(false)

  // Terminal state
  const [terminalCmd, setTerminalCmd] = useState('')
  const [terminalOutput, setTerminalOutput] = useState([])
  const [terminalHistory, setTerminalHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [terminalRunning, setTerminalRunning] = useState(false)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const terminalInputRef = useRef(null)
  const abortControllerRef = useRef(null)

  // Fetch models and check connection
  const checkConnection = useCallback(async () => {
    try {
      const res = await fetch('/api/models')
      if (!res.ok) throw new Error('not ok')
      const data = await res.json()
      const modelList = data.models || []
      setModels(modelList)
      setConnected(true)
      if (modelList.length > 0 && !selectedModel) {
        setSelectedModel(modelList[0].name)
      }
    } catch {
      setConnected(false)
      setModels([])
    }
  }, [selectedModel])

  useEffect(() => {
    checkConnection()
    const interval = setInterval(checkConnection, 15000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Execute a shell command via the API and return result
  const runShell = useCallback(async (command) => {
    try {
      const res = await fetch('/api/shell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      })
      return await res.json()
    } catch (e) {
      return { stdout: '', stderr: String(e), exitCode: 1 }
    }
  }, [])

  // Auto-execute shell commands found in assistant messages
  const executeShellCommandsFromMessage = useCallback(async (assistantText) => {
    const commands = parseShellCommands(assistantText)
    if (commands.length === 0) return

    for (const cmd of commands) {
      const result = await runShell(cmd)
      const outputMsg = [
        `\`\`\`\n$ ${cmd}\n`,
        result.stdout ? result.stdout : '',
        result.stderr ? `STDERR: ${result.stderr}` : '',
        `\`\`\``
      ].filter(Boolean).join('\n')

      setMessages(prev => [...prev, {
        role: 'tool',
        content: `**Shell output** (exit code: ${result.exitCode}):\n${outputMsg}`,
        timestamp: Date.now()
      }])
    }
  }, [runShell])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming || !selectedModel) return

    const userMsg = { role: 'user', content: text, timestamp: Date.now() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setIsStreaming(true)

    const assistantMsg = { role: 'assistant', content: '', timestamp: Date.now() }
    setMessages(prev => [...prev, assistantMsg])

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...newMessages.map(m => ({ role: m.role === 'tool' ? 'user' : m.role, content: m.content }))
    ]

    abortControllerRef.current = new AbortController()

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel, messages: chatMessages, stream: true }),
        signal: abortControllerRef.current.signal
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // keep incomplete line

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const json = JSON.parse(trimmed)
            if (json.message?.content) {
              fullContent += json.message.content
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullContent }
                return updated
              })
            }
          } catch {
            // skip malformed chunks
          }
        }
      }

      setIsStreaming(false)
      // Check for shell commands in the response
      await executeShellCommandsFromMessage(fullContent)
    } catch (e) {
      if (e.name !== 'AbortError') {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: `❌ Error: ${e.message}`,
            error: true
          }
          return updated
        })
      }
      setIsStreaming(false)
    }
  }, [input, isStreaming, selectedModel, messages, systemPrompt, executeShellCommandsFromMessage])

  const stopStreaming = () => {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  // Terminal functions
  const runTerminalCommand = async () => {
    const cmd = terminalCmd.trim()
    if (!cmd || terminalRunning) return

    setTerminalHistory(prev => [cmd, ...prev.slice(0, 99)])
    setHistoryIndex(-1)
    setTerminalCmd('')
    setTerminalRunning(true)

    setTerminalOutput(prev => [...prev, { type: 'cmd', text: `PS> ${cmd}` }])

    const result = await runShell(cmd)

    if (result.stdout) {
      setTerminalOutput(prev => [...prev, { type: 'stdout', text: result.stdout }])
    }
    if (result.stderr) {
      setTerminalOutput(prev => [...prev, { type: 'stderr', text: result.stderr }])
    }
    if (!result.stdout && !result.stderr) {
      setTerminalOutput(prev => [...prev, { type: 'info', text: `(exit code: ${result.exitCode})` }])
    }

    setTerminalRunning(false)
  }

  const handleTerminalKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      runTerminalCommand()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const newIndex = Math.min(historyIndex + 1, terminalHistory.length - 1)
      setHistoryIndex(newIndex)
      if (terminalHistory[newIndex] !== undefined) {
        setTerminalCmd(terminalHistory[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const newIndex = Math.max(historyIndex - 1, -1)
      setHistoryIndex(newIndex)
      setTerminalCmd(newIndex === -1 ? '' : terminalHistory[newIndex])
    }
  }

  const clearTerminal = () => setTerminalOutput([])

  return (
    <div className="app">
      {/* Top bar */}
      <header className="topbar">
        <div className="topbar-left">
          <span className="app-title">🦙 Ollama UI</span>
        </div>
        <div className="topbar-center">
          <select
            className="model-select"
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
            disabled={models.length === 0}
          >
            {models.length === 0 ? (
              <option value="">No models available</option>
            ) : (
              models.map(m => (
                <option key={m.name} value={m.name}>{m.name}</option>
              ))
            )}
          </select>
          <button className="btn-secondary btn-sm" onClick={checkConnection} title="Refresh models">
            ⟳
          </button>
        </div>
        <div className="topbar-right">
          <span className="status-dot" title={connected === true ? 'Ollama connected' : connected === false ? 'Ollama not reachable' : 'Checking...'}>
            <span className={`dot ${connected === true ? 'dot-green' : connected === false ? 'dot-red' : 'dot-yellow'}`}></span>
            <span className="status-label">
              {connected === true ? 'Connected' : connected === false ? 'Disconnected' : 'Checking…'}
            </span>
          </span>
        </div>
      </header>

      {/* Warning banner */}
      <div className="warning-banner">
        ⚠️ System access enabled — AI can execute shell commands on this machine
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'chat' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          💬 Chat
        </button>
        <button
          className={`tab-btn ${activeTab === 'terminal' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('terminal')}
        >
          ⌨️ Terminal
        </button>
      </div>

      {/* Chat tab */}
      {activeTab === 'chat' && (
        <div className="chat-container">
          {/* System prompt toggle */}
          <div className="system-prompt-bar">
            <button className="btn-ghost btn-sm" onClick={() => setShowSystemPrompt(p => !p)}>
              {showSystemPrompt ? '▲' : '▼'} System Prompt
            </button>
            <button className="btn-ghost btn-sm" onClick={clearChat} title="Clear chat history">
              🗑 Clear
            </button>
          </div>
          {showSystemPrompt && (
            <div className="system-prompt-editor">
              <textarea
                className="system-prompt-input"
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                rows={3}
                placeholder="System prompt..."
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
                  {connected === false
                    ? '⚠️ Ollama is not running. Start Ollama on localhost:11434.'
                    : models.length === 0
                    ? 'Loading models…'
                    : `${models.length} model${models.length !== 1 ? 's' : ''} available. Ask me anything, or ask me to run a shell command.`}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`message-row ${msg.role === 'user' ? 'message-user' : msg.role === 'tool' ? 'message-tool' : 'message-assistant'}`}
              >
                <div className={`message-bubble ${msg.role === 'user' ? 'bubble-user' : msg.role === 'tool' ? 'bubble-tool' : 'bubble-assistant'} ${msg.error ? 'bubble-error' : ''}`}>
                  <div className="message-role">
                    {msg.role === 'user' ? '👤 You' : msg.role === 'tool' ? '🖥 Shell' : '🦙 Assistant'}
                  </div>
                  <div className="message-content">
                    {renderMessageContent(msg.content)}
                    {idx === messages.length - 1 && isStreaming && msg.role === 'assistant' && (
                      <span className="cursor-blink">▋</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
                !selectedModel
                  ? 'Select a model to start chatting…'
                  : isStreaming
                  ? 'Waiting for response…'
                  : 'Type a message… (Enter to send, Shift+Enter for newline)'
              }
              disabled={isStreaming || !selectedModel}
              rows={3}
            />
            <div className="input-actions">
              {isStreaming ? (
                <button className="btn-danger" onClick={stopStreaming}>⏹ Stop</button>
              ) : (
                <button
                  className="btn-primary"
                  onClick={sendMessage}
                  disabled={!input.trim() || !selectedModel}
                >
                  Send ➤
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Terminal tab */}
      {activeTab === 'terminal' && (
        <div className="terminal-container">
          <div className="terminal-toolbar">
            <span className="terminal-title">PowerShell — localhost</span>
            <button className="btn-ghost btn-sm" onClick={clearTerminal}>🗑 Clear</button>
          </div>

          <div className="terminal-output">
            {terminalOutput.length === 0 && (
              <div className="terminal-welcome">
                Ready. Type a command below and press Enter or click Run.
              </div>
            )}
            {terminalOutput.map((line, idx) => (
              <div key={idx} className={`terminal-line terminal-${line.type}`}>
                {line.text}
              </div>
            ))}
            {terminalRunning && (
              <div className="terminal-line terminal-info">Running…</div>
            )}
          </div>

          <div className="terminal-input-row">
            <span className="terminal-prompt">PS&gt;</span>
            <input
              ref={terminalInputRef}
              type="text"
              className="terminal-input"
              value={terminalCmd}
              onChange={e => setTerminalCmd(e.target.value)}
              onKeyDown={handleTerminalKeyDown}
              placeholder="Enter a shell command…"
              disabled={terminalRunning}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              className="btn-primary btn-sm"
              onClick={runTerminalCommand}
              disabled={!terminalCmd.trim() || terminalRunning}
            >
              {terminalRunning ? '…' : 'Run'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
