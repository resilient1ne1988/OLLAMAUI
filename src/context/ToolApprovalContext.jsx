import React, { createContext, useContext, useState, useRef, useCallback } from 'react'
import { TOOL_EXECUTORS } from '../tools/definitions'

const ToolApprovalContext = createContext(null)

/**
 * Manages the lifecycle of Ollama native tool calls:
 *   1. requestApproval(name, args) → returns a Promise that resolves when the user acts
 *   2. approve(id)  → executes the tool via /api/shell, resolves the promise with output
 *   3. reject(id)   → resolves the promise with a rejection message, no execution
 */
export function ToolApprovalProvider({ children }) {
  const [calls, setCalls] = useState([])
  // Maps call id → resolve function so the awaiting chat can continue
  const resolversRef = useRef(new Map())
  // Stable ref to calls so approve/reject always see current state
  const callsRef = useRef([])

  const updateCalls = (updater) => {
    setCalls(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      callsRef.current = next
      return next
    })
  }

  const requestApproval = useCallback((name, args) => {
    return new Promise((resolve) => {
      const id = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      resolversRef.current.set(id, resolve)
      updateCalls(prev => [
        ...prev,
        { id, name, args, status: 'pending', timestamp: Date.now(), result: null, exitCode: null }
      ])
    })
  }, [])

  const approve = useCallback(async (id) => {
    const call = callsRef.current.find(c => c.id === id)
    if (!call || call.status !== 'pending') return

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
  }, [])

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

  const pendingCount = calls.filter(c => c.status === 'pending').length

  return (
    <ToolApprovalContext.Provider value={{ calls, pendingCount, requestApproval, approve, reject, clearHistory }}>
      {children}
    </ToolApprovalContext.Provider>
  )
}

export const useToolApproval = () => {
  const ctx = useContext(ToolApprovalContext)
  if (!ctx) throw new Error('useToolApproval must be used inside ToolApprovalProvider')
  return ctx
}
