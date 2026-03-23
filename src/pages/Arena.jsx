import React, { useState } from 'react'
import { useOllama } from '../context/OllamaContext'
import { useArena } from '../hooks/useArena'

function MetricsBadge({ metrics }) {
  if (!metrics) return null
  return (
    <div className="metrics-row">
      {metrics.ttft != null && <span className="metric-badge">TTFT: {metrics.ttft}ms</span>}
      {metrics.duration != null && <span className="metric-badge">⏱ {(metrics.duration / 1000).toFixed(1)}s</span>}
      {metrics.tokenCount != null && <span className="metric-badge">~{metrics.tokenCount} tokens</span>}
    </div>
  )
}

function ModelPanel({ index, output, isRunning }) {
  if (!output) return null
  const statusIcon = output.status === 'streaming' ? '⏳' : output.status === 'done' ? '✅' : output.status === 'error' ? '❌' : '⏸'
  return (
    <div className={`arena-panel arena-panel--${output.status}`}>
      <div className="arena-panel-header">
        <span className="arena-model-name">{statusIcon} {output.model}</span>
        <MetricsBadge metrics={output.metrics} />
      </div>
      <div className="arena-panel-content">
        {output.content || <span className="arena-waiting">Waiting for response…</span>}
        {output.status === 'streaming' && <span className="streaming-cursor">▋</span>}
      </div>
    </div>
  )
}

export default function Arena() {
  const { models } = useOllama()
  const { modelOutputs, isRunning, run, reset } = useArena()
  const [prompt, setPrompt] = useState('')
  const [selectedModels, setSelectedModels] = useState([])

  const toggleModel = (name) => {
    setSelectedModels(prev =>
      prev.includes(name) ? prev.filter(m => m !== name) : prev.length < 4 ? [...prev, name] : prev
    )
  }

  const handleRun = () => {
    if (!prompt.trim() || selectedModels.length === 0) return
    run(prompt, selectedModels)
  }

  const hasResults = Object.keys(modelOutputs).length > 0

  return (
    <div className="page arena-page">
      <div className="page-header">
        <h1 className="page-title">⚔️ Model Arena</h1>
        <div className="page-actions">
          {hasResults && <button className="btn-secondary btn-sm" onClick={reset}>🔄 Reset</button>}
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Select Models (up to 4)</h2>
        {models.length === 0 && <div className="empty-state">No models installed. Pull a model in Model Registry first.</div>}
        <div className="arena-model-picker">
          {models.map(m => (
            <button
              key={m.name}
              className={`arena-model-chip ${selectedModels.includes(m.name) ? 'arena-model-chip--selected' : ''}`}
              onClick={() => toggleModel(m.name)}
              disabled={isRunning}
            >
              {selectedModels.includes(m.name) && <span>✓ </span>}
              {m.name}
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Prompt</h2>
        <textarea
          className="text-input arena-prompt"
          rows={4}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Enter your prompt to send to all selected models simultaneously…"
          disabled={isRunning}
        />
        <div style={{ marginTop: 8 }}>
          <button
            className="btn-primary"
            onClick={handleRun}
            disabled={isRunning || !prompt.trim() || selectedModels.length === 0}
          >
            {isRunning ? '⏳ Running…' : `▶ Run on ${selectedModels.length} model${selectedModels.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      {hasResults && (
        <div className={`arena-grid arena-grid--${Object.keys(modelOutputs).length}`}>
          {Object.entries(modelOutputs).map(([idx, output]) => (
            <ModelPanel key={idx} index={Number(idx)} output={output} isRunning={isRunning} />
          ))}
        </div>
      )}
    </div>
  )
}
