import React from 'react'

export default function StatusBar({ provider, selectedModel, selectedAgent, connected, openclawConnected, onlineMode }) {
  const displayConnected = provider === 'ollama' ? connected : openclawConnected
  const isElectron = typeof window !== 'undefined' && window.navigator.userAgent.includes('Electron')
  return (
    <footer className="status-bar">
      <span className="status-bar-item">
        {provider === 'ollama' ? '🦙 Ollama' : '🦅 OpenClaw'} · {provider === 'ollama' ? (selectedModel || 'No model selected') : (selectedAgent || 'No agent selected')}
      </span>
      <span className="status-bar-sep">|</span>
      <span className={`status-bar-item ${displayConnected === true ? 'status-ok' : 'status-err'}`}>
        {displayConnected === true ? '● Connected' : displayConnected === false ? '● Disconnected' : '● Checking…'}
      </span>
      <span className="status-bar-sep">|</span>
      <span className="status-bar-item">{isElectron ? '⚡ Electron' : '🌐 Browser'}</span>
      {!onlineMode && <><span className="status-bar-sep">|</span><span className="status-bar-item status-warn">✈️ Offline Mode</span></>}
    </footer>
  )
}
