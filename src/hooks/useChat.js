import { useState, useRef, useCallback } from 'react'

export function useChat({ provider, selectedModel, settings }) {
  const [messages, setMessages] = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef(null)

  const stopStreaming = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }
    setIsStreaming(false)
  }, [])

  const sendMessage = useCallback(async (content, params = {}) => {
    if (!content.trim() || isStreaming) return
    const userMsg = { id: crypto.randomUUID(), role: 'user', content, timestamp: Date.now() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setIsStreaming(true)
    const controller = new AbortController()
    abortRef.current = controller
    const assistantMsg = { id: crypto.randomUUID(), role: 'assistant', content: '', timestamp: Date.now(), streaming: true }
    setMessages(prev => [...prev, assistantMsg])
    try {
      let fullContent = ''
      const endpoint = provider === 'openclaw' ? '/api/openclaw/chat' : '/api/chat'
      const body = provider === 'openclaw'
        ? { messages: newMessages, agentId: selectedModel, stream: true }
        : { model: selectedModel, messages: newMessages, stream: true, options: params }
      const headers = { 'Content-Type': 'application/json' }
      if (provider === 'openclaw' && settings?.openclawToken) {
        headers['x-openclaw-token'] = settings.openclawToken
      }
      const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (!res.body) throw new Error('No response body')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          try {
            const stripped = line.startsWith('data:') ? line.slice(5).trim() : line.trim()
            if (!stripped) continue
            if (stripped === '[DONE]') continue
            const data = JSON.parse(stripped)
            let chunk = ''
            if (provider === 'openclaw') {
              chunk = data.choices?.[0]?.delta?.content || ''
            } else {
              chunk = data.message?.content || data.response || ''
            }
            if (chunk) {
              fullContent += chunk
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullContent }
                return updated
              })
            }
          } catch {}
        }
      }
      if (buffer.trim()) {
        try {
          const stripped = buffer.startsWith('data:') ? buffer.slice(5).trim() : buffer.trim()
          if (stripped && stripped !== '[DONE]') {
            const data = JSON.parse(stripped)
            const chunk = provider === 'openclaw'
              ? (data.choices?.[0]?.delta?.content || data.choices?.[0]?.message?.content || '')
              : (data.message?.content || data.response || '')
            if (chunk) {
              fullContent += chunk
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullContent }
                return updated
              })
            }
          }
        } catch {}
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: 'Error: ' + e.message, error: true }
          return updated
        })
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
      setMessages(prev => {
        const updated = [...prev]
        if (updated.length > 0) updated[updated.length - 1] = { ...updated[updated.length - 1], streaming: false }
        return updated
      })
    }
  }, [messages, isStreaming, provider, selectedModel, settings])

  const clearChat = useCallback(() => {
    stopStreaming()
    setMessages([])
  }, [stopStreaming])

  const loadSession = useCallback((session) => {
    setMessages(session.messages || [])
  }, [])

  const saveSession = useCallback(async (name) => {
    if (messages.length === 0) return null
    const session = { id: Date.now().toString(), name: name || 'Chat ' + new Date().toLocaleString(), messages, model: selectedModel, timestamp: Date.now() }
    await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(session) })
    return session
  }, [messages, selectedModel])

  return { messages, isStreaming, sendMessage, stopStreaming, clearChat, loadSession, saveSession, setMessages }
}
