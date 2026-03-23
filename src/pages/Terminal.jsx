import React, { useState, useRef } from 'react'
import { useShellHistory } from '../context/ShellHistoryContext'

async function runShell(command) {
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
}

export default function Terminal() {
  const { addEntry } = useShellHistory()
  const [terminalCmd, setTerminalCmd] = useState('')
  const [terminalOutput, setTerminalOutput] = useState([])
  const [terminalHistory, setTerminalHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [terminalRunning, setTerminalRunning] = useState(false)
  const terminalInputRef = useRef(null)

  const runCommand = async () => {
    const cmd = terminalCmd.trim()
    if (!cmd || terminalRunning) return

    setTerminalHistory(prev => [cmd, ...prev.slice(0, 99)])
    setHistoryIndex(-1)
    setTerminalCmd('')
    setTerminalRunning(true)
    setTerminalOutput(prev => [...prev, { type: 'cmd', text: `PS> ${cmd}` }])

    const result = await runShell(cmd)

    addEntry({ command: cmd, stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode, timestamp: Date.now() })

    if (result.stdout) setTerminalOutput(prev => [...prev, { type: 'stdout', text: result.stdout }])
    if (result.stderr) setTerminalOutput(prev => [...prev, { type: 'stderr', text: result.stderr }])
    if (!result.stdout && !result.stderr) {
      setTerminalOutput(prev => [...prev, { type: 'info', text: `(exit code: ${result.exitCode})` }])
    }

    setTerminalRunning(false)
    terminalInputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      runCommand()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const newIndex = Math.min(historyIndex + 1, terminalHistory.length - 1)
      setHistoryIndex(newIndex)
      if (terminalHistory[newIndex] !== undefined) setTerminalCmd(terminalHistory[newIndex])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const newIndex = Math.max(historyIndex - 1, -1)
      setHistoryIndex(newIndex)
      setTerminalCmd(newIndex === -1 ? '' : terminalHistory[newIndex])
    }
  }

  return (
    <div className="terminal-container">
      <div className="terminal-toolbar">
        <span className="terminal-title">PowerShell — localhost</span>
        <button className="btn-ghost btn-sm" onClick={() => setTerminalOutput([])}>🗑 Clear</button>
      </div>

      <div className="terminal-output">
        {terminalOutput.length === 0 && (
          <div className="terminal-welcome">Ready. Type a command and press Enter.</div>
        )}
        {terminalOutput.map((line, idx) => (
          <div key={idx} className={`terminal-line terminal-${line.type}`}>{line.text}</div>
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
          onKeyDown={handleKeyDown}
          placeholder="Enter a shell command…"
          disabled={terminalRunning}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          className="btn-primary btn-sm"
          onClick={runCommand}
          disabled={!terminalCmd.trim() || terminalRunning}
        >
          {terminalRunning ? '…' : 'Run'}
        </button>
      </div>
    </div>
  )
}
