import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOllama } from '../context/OllamaContext'

const RECIPES = [
  {
    id: 'first-chat',
    icon: '💬',
    title: 'Chat with a local model',
    desc: 'Send your first message to an AI model running entirely on your machine.',
    steps: ['Open Chat Studio', 'Select a model from the dropdown', 'Type a message and press Enter'],
    action: { label: 'Open Chat Studio', page: '/chat' }
  },
  {
    id: 'pull-model',
    icon: '🔽',
    title: 'Download your first model',
    desc: 'Pull a model from the Ollama registry to run it locally.',
    steps: ['Open Model Registry', 'Click a suggested model chip', 'Click Pull and wait'],
    action: { label: 'Open Model Registry', page: '/models' }
  },
  {
    id: 'api-generate',
    icon: '✍️',
    title: 'Generate text from a prompt',
    desc: 'Use the raw generate endpoint (non-chat) for single-turn completion.',
    steps: ['Open API Explorer', 'Select Generate endpoint', 'Enter a model name and prompt', 'Click Send'],
    action: { label: 'Open API Explorer', page: '/api-explorer' }
  },
  {
    id: 'run-command',
    icon: '⌨️',
    title: 'Run a shell command',
    desc: 'Execute PowerShell commands directly from the Terminal tab.',
    steps: ['Open Terminal', 'Type a command like: Get-Date', 'Press Enter or click Run'],
    action: { label: 'Open Terminal', page: '/terminal' }
  },
  {
    id: 'embed-text',
    icon: '🔢',
    title: 'Generate text embeddings',
    desc: 'Convert text into a vector representation using an embedding model.',
    steps: ['Pull nomic-embed-text in Model Registry', 'Open API Explorer', 'Select Embed endpoint', 'Enter text and send'],
    action: { label: 'API Explorer → Embed', page: '/api-explorer' }
  },
  {
    id: 'inspect-model',
    icon: '🔍',
    title: 'Inspect a model\'s details',
    desc: 'See a model\'s template, system prompt, architecture, and configuration.',
    steps: ['Open Model Registry', 'Click Info on any model', 'Read the details modal'],
    action: { label: 'Open Model Registry', page: '/models' }
  }
]

const ENDPOINT_CARDS = [
  { name: '/api/chat', icon: '💬', use: 'Multi-turn conversation', when: 'When you want a back-and-forth chat', example: '{ "model": "llama3.2", "messages": [...] }' },
  { name: '/api/generate', icon: '✍️', use: 'Single-prompt completion', when: 'When you just have one prompt, not a conversation', example: '{ "model": "llama3.2", "prompt": "Explain quantum computing" }' },
  { name: '/api/embed', icon: '🔢', use: 'Text → vectors', when: 'For semantic search, similarity, RAG', example: '{ "model": "nomic-embed-text", "input": "Hello world" }' },
  { name: '/api/tags', icon: '🏷️', use: 'List installed models', when: 'To see what models are available', example: 'GET only — no body needed' },
  { name: '/api/ps', icon: '⚡', use: 'Running model status', when: 'To check VRAM usage and active models', example: 'GET only — no body needed' },
  { name: '/api/pull', icon: '🔽', use: 'Download a model', when: 'To add a new model to your local library', example: '{ "name": "llama3.2" }' },
  { name: '/api/show', icon: '🔍', use: 'Model inspection', when: 'To read a model\'s template, system prompt, config', example: '{ "name": "llama3.2" }' },
  { name: '/api/create', icon: '🛠️', use: 'Create custom model', when: 'To build a customized model from a Modelfile', example: '{ "name": "my-bot", "modelfile": "FROM llama3.2\\nSYSTEM You are a pirate." }' },
]

const MODEL_FAMILIES = [
  { family: 'Llama', by: 'Meta', models: 'llama3.2:1b, llama3.2:3b, llama3.1:8b', bestFor: 'General chat, reasoning, code', notes: 'Most popular open model family' },
  { family: 'Qwen', by: 'Alibaba', models: 'qwen2.5:0.5b, qwen2.5:7b, qwen2.5-coder:7b', bestFor: 'Multilingual, code, math', notes: 'Excellent at coding tasks' },
  { family: 'Mistral', by: 'Mistral AI', models: 'mistral:7b, mistral-nemo', bestFor: 'Instruction following, coding', notes: 'High quality at smaller sizes' },
  { family: 'Phi', by: 'Microsoft', models: 'phi3:mini, phi3:medium', bestFor: 'Reasoning with low VRAM', notes: 'Great efficiency for size' },
  { family: 'Gemma', by: 'Google', models: 'gemma2:2b, gemma2:9b', bestFor: 'Chat, summarization', notes: 'Strong safety tuning' },
  { family: 'Nomic Embed', by: 'Nomic AI', models: 'nomic-embed-text', bestFor: 'Semantic similarity, RAG', notes: 'Embedding-only model' },
]

const SHORTCUTS = [
  { key: 'Ctrl+1', action: 'Go to Dashboard' },
  { key: 'Ctrl+2', action: 'Go to Chat' },
  { key: 'Ctrl+3', action: 'Go to Models' },
  { key: 'Ctrl+4', action: 'Go to API Explorer' },
  { key: 'Ctrl+5', action: 'Go to Terminal' },
  { key: 'Ctrl+6', action: 'Go to Settings' },
  { key: 'Ctrl+7', action: 'Go to Learn' },
  { key: 'Enter', action: 'Send chat message' },
  { key: 'Shift+Enter', action: 'New line in chat' },
  { key: '↑ / ↓', action: 'Navigate terminal history' },
  { key: 'Ctrl+L', action: 'Clear terminal' },
]

export default function LearnOllama() {
  const navigate = useNavigate()
  const { models } = useOllama()
  const [activeSection, setActiveSection] = useState('recipes')

  const sections = [
    { id: 'recipes', label: '🍳 Quick Recipes' },
    { id: 'endpoints', label: '🔌 Endpoints Guide' },
    { id: 'models', label: '🗂️ Model Families' },
    { id: 'openclaw', label: '🦅 OpenClaw Guide' },
    { id: 'shortcuts', label: '⌨️ Shortcuts' },
  ]

  return (
    <div className="page learn-page">
      <div className="page-header">
        <h1 className="page-title">📚 Learn Ollama</h1>
        <p className="page-sub">Everything a beginner needs to get the most out of local AI.</p>
      </div>

      {/* What is Ollama */}
      <div className="learn-hero">
        <div className="learn-hero-icon">🦙</div>
        <div className="learn-hero-body">
          <h2>What is Ollama?</h2>
          <p>Ollama lets you run powerful AI models <strong>entirely on your own computer</strong> — no internet required, no API keys, no usage fees. You download a model once, and it runs locally at full speed.</p>
          <p>BTCMACHINE is your control center for Ollama. You can chat with models, manage your model library, explore the API, run shell commands, and analyze BTC data — all from one interface.</p>
          <div className="hero-stats">
            <span className="hero-stat"><strong>{models.length}</strong> models installed</span>
            <span className="hero-stat">🌐 Runs fully offline</span>
            <span className="hero-stat">🔒 Private by design</span>
          </div>
        </div>
      </div>

      {/* Section nav */}
      <div className="learn-tabs">
        {sections.map(s => (
          <button key={s.id} className={`learn-tab ${activeSection === s.id ? 'learn-tab-active' : ''}`} onClick={() => setActiveSection(s.id)}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Recipes */}
      {activeSection === 'recipes' && (
        <div className="recipes-grid">
          {RECIPES.map(r => (
            <div key={r.id} className="recipe-card">
              <div className="recipe-icon">{r.icon}</div>
              <div className="recipe-title">{r.title}</div>
              <div className="recipe-desc">{r.desc}</div>
              <ol className="recipe-steps">
                {r.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
              <button className="btn-primary btn-sm recipe-action" onClick={() => navigate(r.action.page)}>
                {r.action.label} →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Endpoints guide */}
      {activeSection === 'endpoints' && (
        <div className="endpoints-guide">
          <div className="guide-intro">
            <p>Ollama exposes a simple REST API. Here are the most important endpoints and when to use each one.</p>
          </div>
          {ENDPOINT_CARDS.map(ep => (
            <div key={ep.name} className="endpoint-guide-card">
              <div className="ep-guide-header">
                <span className="ep-guide-icon">{ep.icon}</span>
                <code className="ep-guide-name">{ep.name}</code>
                <span className="ep-guide-use">{ep.use}</span>
              </div>
              <div className="ep-guide-body">
                <div className="ep-guide-when"><strong>Use when:</strong> {ep.when}</div>
                <div className="ep-guide-example">
                  <span className="ep-guide-example-label">Example:</span>
                  <code>{ep.example}</code>
                </div>
              </div>
              <button className="btn-ghost btn-sm" onClick={() => navigate('/api-explorer')}>Try in API Explorer →</button>
            </div>
          ))}
        </div>
      )}

      {/* Model families */}
      {activeSection === 'models' && (
        <div className="model-families">
          <div className="guide-intro">
            <p>Ollama supports hundreds of models. Here's a guide to the major families and what they're good at.</p>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Family</th><th>Made by</th><th>Popular Models</th><th>Best For</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {MODEL_FAMILIES.map(f => (
                <tr key={f.family}>
                  <td><strong>{f.family}</strong></td>
                  <td>{f.by}</td>
                  <td><code style={{fontSize:'11px'}}>{f.models}</code></td>
                  <td>{f.bestFor}</td>
                  <td style={{color:'var(--text-secondary)'}}>{f.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="guide-note">
            💡 <strong>Tip:</strong> For most beginners, start with <code>llama3.2:1b</code> (fast, small) or <code>llama3.2</code> (better quality). Both are already installed.
          </div>
        </div>
      )}

      {/* OpenClaw guide */}
      {activeSection === 'openclaw' && (
        <div className="openclaw-guide">
          <div className="openclaw-hero">
            <div className="learn-hero-icon">🦅</div>
            <div>
              <h2>What is OpenClaw?</h2>
              <p>OpenClaw is a local AI agent platform that runs specialized agents on your machine. Unlike Ollama (which runs open-source models), OpenClaw connects to powerful AI providers like OpenAI and orchestrates multi-agent workflows.</p>
            </div>
          </div>
          <div className="section">
            <h3>BTC Decision Agents</h3>
            <p>Your OpenClaw installation includes a fleet of Bitcoin market analysis agents:</p>
            <div className="agents-grid">
              {[
                { id: 'main', desc: 'General purpose agent — good for anything' },
                { id: 'btc-chief', desc: 'Chief BTC decision maker — synthesizes all desk reports' },
                { id: 'btc-price-desk', desc: 'Technical price analysis and pattern recognition' },
                { id: 'btc-catalyst-desk', desc: 'News, events, and on-chain catalysts' },
                { id: 'btc-macro-desk', desc: 'Macro environment: Fed, equities, dollar, rates' },
                { id: 'btc-flow-desk', desc: 'Order flow, futures, options, funding rates' },
                { id: 'btc-bookmaker-desk', desc: 'Market microstructure and betting odds' },
                { id: 'btc-market-intelligence-desk', desc: 'Broader market intelligence and sentiment' },
                { id: 'btc-opportunity-ranker-desk', desc: 'Ranks trading opportunities by quality' },
                { id: 'btc-question-lab-desk', desc: 'Research and hypothesis testing' },
              ].map(a => (
                <div key={a.id} className="agent-card">
                  <div className="agent-name"><code>{a.id}</code></div>
                  <div className="agent-desc">{a.desc}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="section">
            <h3>How to connect OpenClaw</h3>
            <ol className="guide-steps">
              <li>Make sure OpenClaw is running on your machine</li>
              <li>Go to <button className="link-btn" onClick={() => navigate('/settings')}>⚙️ Settings</button></li>
              <li>Set your OpenClaw Gateway Port (default: 18789)</li>
              <li>Paste your gateway auth token from <code>openclaw.json → gateway.auth.token</code></li>
              <li>Click "Test OpenClaw" to verify the connection</li>
              <li>In the Chat Studio, switch the Provider dropdown from "🦙 Ollama" to "🦅 OpenClaw"</li>
              <li>Select an agent from the model dropdown and start chatting</li>
            </ol>
          </div>
        </div>
      )}

      {/* Shortcuts */}
      {activeSection === 'shortcuts' && (
        <div className="shortcuts-guide">
          <table className="data-table">
            <thead><tr><th>Shortcut</th><th>Action</th></tr></thead>
            <tbody>
              {SHORTCUTS.map(s => (
                <tr key={s.key}>
                  <td><kbd className="kbd">{s.key}</kbd></td>
                  <td>{s.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
