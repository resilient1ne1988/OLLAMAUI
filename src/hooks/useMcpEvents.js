import { useState, useEffect, useRef, useCallback } from 'react'

export function useMcpEvents() {
  const [mcpStatus, setMcpStatus] = useState({ running: false })
  const [mcpLogs, setMcpLogs] = useState([])
  const [mcpCrashed, setMcpCrashed] = useState(false)
  const prevRunning = useRef(null)
  const esRef = useRef(null)

  useEffect(() => {
    const es = new EventSource('/api/mcp/events')
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data)
        if (evt.type === 'status') {
          setMcpStatus(evt)
          // Detect crash: was running, now not, with non-zero exit
          if (prevRunning.current === true && evt.running === false && evt.exitCode !== null && evt.exitCode !== 0) {
            setMcpCrashed(true)
          }
          prevRunning.current = evt.running
        } else if (evt.type === 'log') {
          setMcpLogs(prev => [evt.line, ...prev].slice(0, 500))
        }
      } catch {}
    }

    es.onerror = () => {}

    return () => { es.close(); esRef.current = null }
  }, [])

  const dismissCrash = useCallback(() => setMcpCrashed(false), [])

  return { mcpStatus, mcpLogs, mcpCrashed, dismissCrash }
}
