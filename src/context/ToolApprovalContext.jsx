import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import { TOOL_EXECUTORS } from '../tools/definitions'

const ToolApprovalContext = createContext(null)

/**
 * Manages the lifecycle of Ollama native tool calls with full policy support:
 *
 *   Policy modes (set in Settings → Shell Safety):
 *   - 'approval' (default) ─ queue every call for manual user review
 *   - 'session'            ─ first call for a tool queues for review;
 *                            subsequent calls to the same tool auto-execute
 *   - 'always'             ─ all calls auto-execute without user prompt
 *   - 'deny'               ─ all calls are immediately rejected
 *
 *   API:
 *   - requestApproval(name, args) → Promise<{ approved, output }>
 *   - approve(id)    → executes via /api/shell, resolves the pending promise
 *   - reject(id)     → resolves with rejection, no execution
 *   - clearHistory() → removes completed/rejected entries from the list
 *   - clearSessionAllowlist() → resets the session-approved tool set
 *   - policy         → current shellSafety string (live from settings)
 *   - sessionAllowed → Set<string> of tool names approved for this session
 */
export function ToolApprovalProvider({ children }) {
  const [calls, setCalls] = useState([])
  const [policy, setPolicy] = useState('approval')
  // sessionAllowed is exposed as state so ApprovalCenter can render it
  const [sessionAllowed, setSessionAllowed] = useState(new Set())

  // Maps call id → resolve function so the awaiting chat can continue
  const resolversRef = useRef(new Map())
  // Stable ref so approve/reject always see current calls
  const callsRef = useRef([])

  // Load policy from server on mount
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => { if (d.shellSafety) setPolicy(d.shellSafety) })
      .catch(() => {})
  }, [])

  const updateCalls = (updater) => {
    setCalls(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      callsRef.current = next
      return next
    })
  }

  // Execute a tool immediately (used for 'always' and 'session' auto-paths)
  const executeNow = useCallback(async (id, name, args) => {
    let output = ''
    let exitCode = 0
    try {
      const executor = TOOL_EXECUTORS[name]
      if (!executor) throw new Error(`No executor registered for tool "${name}"`)
      const result = await executor(args)
      output = result.output
      exitCode = result.exitCode
    } catch (e) {
      output = `Execution error: ${e.message}`
      exitCode = 1
    }
    updateCalls(prev =>
      prev.map(c => c.id === id ? { ...c, status: 'approved', result: output, exitCode } : c)
    )
    return { approved: true, output }
  }, [])

  const requestApproval = useCallback(async (name, args) => {
    // Re-fetch policy so changes in Settings take effect without page reload
    let currentPolicy = policy
    try {
      const d = await fetch('/api/settings').then(r => r.json())
      if (d.shellSafety) {
        currentPolicy = d.shellSafety
        setPolicy(d.shellSafety)
      }
    } catch {}

    const id = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const entry = { id, name, args, timestamp: Date.now(), result: null, exitCode: null }

    // ── deny: block immediately ──────────────────────────────────────────
    if (currentPolicy === 'deny') {
      updateCalls(prev => [...prev, {
        ...entry,
        status: 'rejected',
        result: 'Blocked by Shell Safety policy (\'deny\').'
      }])
      return {
        approved: false,
        output: 'Shell execution blocked by policy. Go to Settings → Shell Safety to allow tool calls.'
      }
    }

    // ── always: auto-execute without user prompt ───────────────────────────
    if (currentPolicy === 'always') {
      updateCalls(prev => [...prev, { ...entry, status: 'running' }])
      return executeNow(id, name, args)
    }

    // ── session: auto-execute if this tool was already approved this session ──
    if (currentPolicy === 'session') {
      const isSessionAllowed = sessionAllowed.has(name)
      if (isSessionAllowed) {
        updateCalls(prev => [...prev, { ...entry, status: 'running', sessionAuto: true }])
        return executeNow(id, name, args)
      }
    }

    // ── approval (or first-time session call): queue for user review ─────────
    return new Promise((resolve) => {
      resolversRef.current.set(id, resolve)
      updateCalls(prev => [...prev, { ...entry, status: 'pending' }])
    })
  }, [policy, sessionAllowed, executeNow])

  const approve = useCallback(async (id) => {
    const call = callsRef.current.find(c => c.id === id)
    if (!call || call.status !== 'pending') return

    // Under session policy, remember this tool is allowed for the rest of the session
    let currentPolicy = policy
    try {
      const d = await fetch('/api/settings').then(r => r.json())
      if (d.shellSafety) currentPolicy = d.shellSafety
    } catch {}
    if (currentPolicy === 'session') {
      setSessionAllowed(prev => new Set([...prev, call.name]))
    }

    updateCalls(prev => prev.map(c => c.id === id ? { ...c, status: 'running' } : c))

    let output = ''
    let exitCode = 0
    try {
      const executor = TOOL_EXECUTORS[call.name]
      if (!executor) throw new Error(`No executor registered for tool "${call.name}"`)
      const result = await executor(call.args)
      output = result.output
      exitCode = result.exitCode
    } catch (e) {
      output = `Execution error: ${e.message}`
      exitCode = 1
    }

    updateCalls(prev =>
      prev.map(c => c.id === id ? { ...c, status: 'approved', result: output, exitCode } : c)
    )
    resolversRef.current.get(id)?.({ approved: true, output })
    resolversRef.current.delete(id)
  }, [policy])

  const reject = useCallback((id) => {
    const call = callsRef.current.find(c => c.id === id)
    if (!call || call.status !== 'pending') return
    updateCalls(prev =>
      prev.map(c => c.id === id ? { ...c, status: 'rejected' } : c)
    )
    resolversRef.current.get(id)?.({ approved: false, output: 'Tool call rejected by user.' })
    resolversRef.current.delete(id)
  }, [])

  const clearHistory = useCallback(() => {
    updateCalls(prev => prev.filter(c => c.status === 'pending'))
  }, [])

  const clearSessionAllowlist = useCallback(() => {
    setSessionAllowed(new Set())
  }, [])

  const pendingCount = calls.filter(c => c.status === 'pending').length

  return (
    <ToolApprovalContext.Provider value={{
      calls,
      pendingCount,
      policy,
      sessionAllowed,
      requestApproval,
      approve,
      reject,
      clearHistory,
      clearSessionAllowlist
    }}>
      {children}
    </ToolApprovalContext.Provider>
  )
}

export const useToolApproval = () => {
  const ctx = useContext(ToolApprovalContext)
  if (!ctx) throw new Error('useToolApproval must be used inside ToolApprovalProvider')
  return ctx
}
