import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useOllama } from '../context/OllamaContext'
import { useSettings } from '../context/SettingsContext'
import { useChatHistory } from '../context/ChatHistoryContext'
import { useToolApproval } from '../context/ToolApprovalContext'
import { useChat } from '../hooks/useChat'
import { useWorkspace } from '../context/WorkspaceContext'
import ConflictBanner from '../components/ConflictCenter/ConflictBanner'
import CaptureDirector from '../components/CaptureDirector/CaptureDirector'
import MessageBubble from '../components/MessageBubble'
import CreateEntityDialog from '../components/EntityThreading/CreateEntityDialog'
import EntitySuggestionChip from '../components/EntityThreading/EntitySuggestionChip'
import { useAutoNer } from '../hooks/useAutoNer'
import SystemPromptEditor from '../components/SystemPromptEditor'
import InspectionPanel from '../components/InspectionPanel/InspectionPanel'
import WorkspacePanel from '../components/WorkspacePanel/WorkspacePanel'


export default function ChatStudio() {
  const { selectedModel, models, connected } = useOllama()
  const { settings } = useSettings()
  const { autoSave, startNewSession } = useChatHistory()
  const { requestApproval } = useToolApproval()
  const { activeWorkspaceId } = useWorkspace()
  const [input, setInput] = useState('')
  const [toastMsg, setToastMsg] = useState('')
  const [lastAssistantMessageId, setLastAssistantMessageId] = useState(null)
  const [inspectionTab, setInspectionTab] = useState('claims')
  const [systemPrompt, setSystemPrompt] = useState('')
  const messagesEndRef = useRef(null)
  const prevIsStreamingRef = useRef(false)

  const { suggestions: nerSuggestions, extractFromText, dismiss: dismissNer } = useAutoNer(activeWorkspaceId)

  const [selectedText, setSelectedText] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [floatPos, setFloatPos] = useState(null)

  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 2500) }

  const { messages, isStreaming, sendMessage, stopStreaming, clearChat } = useChat({
    provider: 'ollama',
    selectedModel,
    settings,
    systemPrompt,
    onToolCall: requestApproval,
  })

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Auto-segment claims when streaming finishes
  useEffect(() => {
    const wasStreaming = prevIsStreamingRef.current
    prevIsStreamingRef.current = isStreaming
    if (wasStreaming && !isStreaming && messages.length > 0) {
      const lastMsg = messages[messages.length - 1]
      if (lastMsg.role === 'assistant' && lastMsg.id && lastMsg.content && !lastMsg.error) {
        const msgId = lastMsg.id
        const text = lastMsg.content
        fetch(`/api/messages/${msgId}/claims/segment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, sources: [] }),
        })
          .then(r => r.json())
          .catch(() => ({}))
          .finally(() => { setLastAssistantMessageId(msgId); setInspectionTab('claims') })
        extractFromText(text)
      }
    }
  }, [isStreaming, messages])

  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) { setFloatPos(null); return }
      const text = sel.toString().trim()
      if (!text) { setFloatPos(null); return }
      const anchor = sel.anchorNode
      let el = anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor
      while (el && el !== document.body) {
        if (el.classList?.contains('message-bubble')) {
          const range = sel.getRangeAt(0)
          const rect = range.getBoundingClientRect()
          setSelectedText(text)
          setFloatPos({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX })
          return
        }
        el = el.parentElement
      }
      setFloatPos(null)
    }
    document.addEventListener('selectionchange', handleSelection)
    return () => document.removeEventListener('selectionchange', handleSelection)
  }, [])

  const handleSend = () => {
    if (!input.trim() || isStreaming) return
    sendMessage(input)
    setInput('')
  }

  const handleSave = async () => {
    const saved = await autoSave(messages, selectedModel, 'ollama')
    showToast(saved ? '✅ Session saved' : '❌ Save failed')
  }

  const handleNewChat = () => {
    clearChat()
    startNewSession()
    setLastAssistantMessageId(null)
  }

  const handleRegenerate = useCallback(() => {}, [])

  const handleEntityCreated = useCallback((entity) => {
    setShowCreateDialog(false)
    setFloatPos(null)
    showToast(`✅ Entity "${entity.name}" created`)
  }, [])

  const handleAskFollowUp = useCallback((text) => {
    setInput(text)
  }, [])

  return (
    <div className="chat-studio-page">
      <div className="page-header">
        <h1 className="page-title">💬 Chat Studio</h1>
        <div className="page-actions">
          <button disabled={messages.length === 0} className="btn-secondary btn-sm" onClick={handleSave}>💾 Save</button>
          <button className="btn-secondary btn-sm" onClick={handleNewChat}>🆕 New Chat</button>
        </div>
      </div>

      {!connected && (
        <div className="alert alert-warn" style={{ margin: '0 16px 0' }}>⚠️ Ollama not connected. Start Ollama to use Chat Studio.</div>
      )}

      <div className="chat-studio-body">
        <WorkspacePanel onOpenEntities={() => setInspectionTab('entities')} />
        <div className="chat-studio-main">
          <SystemPromptEditor model={selectedModel} onPromptChange={setSystemPrompt} />
          <ConflictBanner workspaceId={activeWorkspaceId} messageId={lastAssistantMessageId} />
          <CaptureDirector workspaceId={activeWorkspaceId} messageText={input} onFollowSuggestion={() => {}} />
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-empty">
                <div className="chat-empty-icon">💬</div>
                <div className="chat-empty-text">Start a conversation with {selectedModel || 'a model'}</div>
              </div>
            )}
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} onCopy={() => showToast('Copied!')} />
            ))}
            {nerSuggestions.length > 0 && (
              <div className="ner-suggestions-row">
                {nerSuggestions.map(s => (
                  <EntitySuggestionChip
                    key={s.text}
                    entity={{ name: s.text, entityType: s.type }}
                    onOpen={() => { setSelectedText(s.text); setShowCreateDialog(true); dismissNer(s.text) }}
                  />
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-row">
            <textarea
              className="chat-textarea"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder={`Message ${selectedModel || 'model'}… (Enter to send, Shift+Enter for newline)`}
              disabled={isStreaming || !connected}
              rows={3}
            />
            <div className="chat-send-col">
              {isStreaming
                ? <button className="btn-secondary" onClick={stopStreaming}>⏹ Stop</button>
                : <button className="btn-primary" onClick={handleSend} disabled={!input.trim() || !connected}>▶ Send</button>
              }
            </div>
          </div>
        </div>

        <InspectionPanel
          activeTab={inspectionTab}
          onTabChange={setInspectionTab}
          messageId={lastAssistantMessageId}
          workspaceId={activeWorkspaceId}
          onAskFollowUp={handleAskFollowUp}
          onRegenerate={handleRegenerate}
        />
      </div>

      {toastMsg && <div className="toast">{toastMsg}</div>}

      {floatPos && (
        <button
          className="create-entity-btn-float"
          style={{ top: floatPos.top, left: floatPos.left }}
          onMouseDown={e => { e.preventDefault(); setShowCreateDialog(true) }}
        >
          📌 Create Entity
        </button>
      )}

      {showCreateDialog && (
        <CreateEntityDialog
          selectedText={selectedText}
          workspaceId={activeWorkspaceId}
          onCreated={handleEntityCreated}
          onClose={() => setShowCreateDialog(false)}
        />
      )}
    </div>
  )
}



