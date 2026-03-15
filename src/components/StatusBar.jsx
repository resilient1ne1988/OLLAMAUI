import React from 'react'

export default function StatusBar({ ollamaConnected, openclawConnected, selectedModel, activeStreams, appInfo }) {
  return (
    <footer className="status-bar">
      <span className="status-item">
        <span className={`status-dot ${ollamaConnected ? 'dot-green' : 'dot-red'}`}></span>
        Ollama {ollamaConnected ? 'connected' : 'offline'}
      </span>
      <span className="status-sep">|</span>
      <span className="status-item">
        <span className={`status-dot ${openclawConnected ? 'dot-green' : 'dot-red'}`}></span>
        OpenClaw {openclawConnected ? 'connected' : 'offline'}
      </span>
      {selectedModel && (
        <>
          <span className="status-sep">|</span>
          <span className="status-item">Model: {selectedModel.replace(/:latest$/, '')}</span>
        </>
      )}
      {activeStreams > 0 && (
        <>
          <span className="status-sep">|</span>
          <span className="status-item status-streaming">⚡ {activeStreams} streaming</span>
        </>
      )}
      {appInfo && (
        <>
          <span className="status-sep">|</span>
          <span className="status-item">{appInfo.mode || 'browser'}</span>
          <span className="status-sep">|</span>
          <span className="status-item">v{appInfo.version || '2.0.0'}</span>
        </>
      )}
    </footer>
  )
}
