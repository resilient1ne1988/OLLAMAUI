import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import { TOOL_EXECUTORS } from '../tools/definitions'
import { useSettings } from './SettingsContext'

const ToolApprovalContext = createContext(null)

export function ToolApprovalProvider({ children }) {
  const { settings } = useSettings()
  const policy = settings.shellSafety || 'approval'
  const [calls, setCalls] = useState([])
  const [sessionAllowed, setSessionAllowed] = useState(new Set())
  const resolversRef = useRef(new Map())
  const callsRef = useRef([])

  const updateCalls = (updater) => {
    setCalls(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      callsRef.current = next
      return next
    })
  }

  const executeNow = useCallback(async (id, name, args) => {
    let output = '', exitCode = 0
    try {
      const executor = TOOL_EXECUTORS[name]
      if (!executor) throw new Error(`No executor for "${name}"`)
      const result = await executor(args)
      output = result.output; exitCode = result.exitCode
    } catch (e) { output = `Execution error: ${e.message}`; exitCode = 1 }
    updateCalls(prev => prev.map(c => c.id === id ? { ...c, status: 'approved', result: output, exitCode } : c))
    return { approved: true, output }
  }, [])

  const requestApproval = useCallback(async (name, args) => {
    const id = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const entry = { id, name, args, timestamp: Date.now(), result: null, exitCode: null }

    if (policy === 'deny') {
      updateCalls(prev => [...prev, { ...entry, status: 'rejected', result: 'Blocked by Shell Safety policy.' }])
      return { approved: false, output: 'Shell execution blocked by policy.' }
    }
    if (policy === 'always') {
      updateCalls(prev => [...prev, { ...entry, status: 'running' }])
      return executeNow(id, name, args)
    }
    if (policy === 'session' && sessionAllowed.has(name)) {
      updateCalls(prev => [...prev, { ...entry, status: 'running', sessionAuto: true }])
      return executeNow(id, name, args)
    }
    return new Promise((resolve) => {
      resolversRef.current.set(id, resolve)
      updateCalls(prev => [...prev, { ...entry, status: 'pending' }])
    })
  }, [policy, sessionAllowed, executeNow])

  const approve = useCallback(async (id) => {
    const call = callsRef.current.find(c => c.id === id)
    if (!call || call.status !== 'pending') return
    if (policy === 'session') setSessionAllowed(prev => new Set([...prev, call.name]))
    updateCalls(prev => prev.map(c => c.id === id ? { ...c, status: 'running' } : c))
    let output = '', exitCode = 0
    try {
      const executor = TOOL_EXECUTORS[call.name]
      if (!executor) throw new Error(`No executor for "${call.name}"`)
      const result = await executor(call.args)
      output = result.output; exitCode = result.exitCode
    } catch (e) { output = `Execution error: ${e.message}`; exitCode = 1 }
    updateCalls(prev => prev.map(c => c.id === id ? { ...c, status: 'approved', result: output, exitCode } : c))
    resolversRef.current.get(id)?.({ approved: true, output })
    resolversRef.current.delete(id)
  }, [policy])

  const reject = useCallback((id) => {
    const call = callsRef.current.find(c => c.id === id)
    if (!call || call.status !== 'pending') return
    updateCalls(prev => prev.map(c => c.id === id ? { ...c, status: 'rejected' } : c))
    resolversRef.current.get(id)?.({ approved: false, output: 'Tool call rejected by user.' })
    resolversRef.current.delete(id)
  }, [])

  const clearHistory = useCallback(() => updateCalls(prev => prev.filter(c => c.status === 'pending')), [])
  const clearSessionAllowlist = useCallback(() => setSessionAllowed(new Set()), [])
  const pendingCount = calls.filter(c => c.status === 'pending').length

  return (
    <ToolApprovalContext.Provider value={{ calls, pendingCount, policy, sessionAllowed, requestApproval, approve, reject, clearHistory, clearSessionAllowlist }}>
      {children}
    </ToolApprovalContext.Provider>
  )
}

export const useToolApproval = () => {
  const ctx = useContext(ToolApprovalContext)
  if (!ctx) throw new Error('useToolApproval must be used inside ToolApprovalProvider')
  return ctx
}