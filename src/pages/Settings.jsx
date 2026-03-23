import React, { useState, useEffect } from 'react'
import { useSettings } from '../context/SettingsContext'
import { useWorkspace } from '../context/WorkspaceContext'
import WorkspaceMemorySettings from '../components/MemoryPolicy/WorkspaceMemorySettings'

export default function Settings() {
  const { settings: ctxSettings, saveSettings } = useSettings()
  const { workspaces, activeWorkspaceId } = useWorkspace()
  const activeWorkspace = workspaces?.find(w => w.id === activeWorkspaceId) || null
  const [settings, setSettings] = useState(ctxSettings)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setSettings(ctxSettings) }, [ctxSettings])
  const [appInfo, setAppInfo] = useState(null)
  const [testOllama, setTestOllama] = useState(null)
  const [testOllamaLoading, setTestOllamaLoading] = useState(false)
  const [testOpenClaw, setTestOpenClaw] = useState(null)
  const [testOpenClawLoading, setTestOpenClawLoading] = useState(false)
  const [mcpStatus, setMcpStatus] = useState(null)
  const [mcpLoading, setMcpLoading] = useState(false)
  const [mcpLogs, setMcpLogs] = useState([])

  useEffect(() => {
    fetch('/api/app-info').then(r => r.json()).then(setAppInfo).catch(() => {})
    fetch('/api/mcp/status').then(r => r.json()).then(setMcpStatus).catch(() => {})
    fetch('/api/mcp/logs').then(r => r.json()).then(d => setMcpLogs(Array.isArray(d?.logs) ? d.logs : [])).catch(() => {})
  }, [])

  const save = async () => {
    await saveSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const testOllamaConn = async () => {
    setTestOllamaLoading(true)
    setTestOllama(null)
    try {
      const res = await fetch('/api/ollama-version')
      const d = await res.json()
      setTestOllama({ ok: true, msg: `✅ Connected — Ollama v${d.version}` })
    } catch { setTestOllama({ ok: false, msg: '❌ Ollama not reachable on localhost:11434' }) }
    setTestOllamaLoading(false)
  }

  const testOpenClawConn = async () => {
    setTestOpenClawLoading(true)
    setTestOpenClaw(null)
    try {
      const res = await fetch('/api/openclaw/status')
      const d = await res.json()
      setTestOpenClaw({ ok: d.reachable, msg: d.reachable ? `✅ OpenClaw reachable on port ${d.port}` : `❌ Not reachable: ${d.message}` })
    } catch { setTestOpenClaw({ ok: false, msg: '❌ OpenClaw status check failed' }) }
    setTestOpenClawLoading(false)
  }

  const exportData = async () => {
    try {
      const [sessions, shellHistory] = await Promise.all([
        fetch('/api/sessions').then(r => r.json()),
        fetch('/api/shell-history').then(r => r.json())
      ])
      const bundle = { settings, sessions, shellHistory, exportedAt: new Date().toISOString() }
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `btcmachine-backup-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert('Export failed: ' + e.message) }
  }

  const copyDiagnostics = async () => {
    try {
      const [health, appinfo, version] = await Promise.all([
        fetch('/api/health').then(r => r.json()),
        fetch('/api/app-info').then(r => r.json()),
        fetch('/api/ollama-version').then(r => r.json()).catch(() => ({ error: 'not reachable' }))
      ])
      const bundle = { health, appinfo, ollamaVersion: version, timestamp: new Date().toISOString(), userAgent: navigator.userAgent }
      navigator.clipboard.writeText(JSON.stringify(bundle, null, 2))
      alert('Diagnostic bundle copied to clipboard!')
    } catch { alert('Failed to collect diagnostics') }
  }

  const set = (key, val) => setSettings(prev => ({ ...prev, [key]: val }))

  const refreshMcp = async () => {
    setMcpLoading(true)
    try {
      const [statusRes, logsRes] = await Promise.all([
        fetch('/api/mcp/status'),
        fetch('/api/mcp/logs')
      ])
      const status = await statusRes.json()
      const logs = await logsRes.json()
      setMcpStatus(status)
      setMcpLogs(Array.isArray(logs?.logs) ? logs.logs : [])
    } catch {
      setMcpStatus({ running: false, lastError: 'MCP server status check failed' })
      setMcpLogs([])
    } finally {
      setMcpLoading(false)
    }
  }

  const startMcp = async () => {
    setMcpLoading(true)
    try {
      const res = await fetch('/api/mcp/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: settings.mcpServerCommand, cwd: settings.mcpServerCwd || undefined })
      })
      const d = await res.json()
      if (!res.ok || !d.ok) {
        alert(`Failed to start MCP server: ${d.error || res.statusText}`)
      }
    } catch (e) {
      alert('Failed to start MCP server: ' + e.message)
    } finally {
      await refreshMcp()
    }
  }

  const stopMcp = async () => {
    setMcpLoading(true)
    try {
      await fetch('/api/mcp/stop', { method: 'POST' })
    } catch (e) {
      alert('Failed to stop MCP server: ' + e.message)
    } finally {
      await refreshMcp()
    }
  }

  return (
    <div className="page settings-page">
      <div className="page-header">
        <h1 className="page-title">⚙️ Settings</h1>
        <div className="page-actions">
          <button className="btn-primary" onClick={save}>{saved ? '✅ Saved!' : '💾 Save Settings'}</button>
        </div>
      </div>

      {/* Connection */}
      <div className="settings-section">
        <h2 className="settings-section-title">🔗 Connection</h2>
        <div className="settings-grid">
          <div className="form-field">
            <label className="form-label">Ollama URL</label>
            <input className="text-input" value={settings.ollamaUrl} onChange={e => set('ollamaUrl', e.target.value)} />
            <div className="field-note">Local Ollama server. Default: http://localhost:11434</div>
          </div>
          <div className="form-field">
            <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
              <button className="btn-secondary btn-sm" onClick={testOllamaConn} disabled={testOllamaLoading}>
                {testOllamaLoading ? '⏳' : '🔍 Test Ollama'}
              </button>
              {testOllama && <span className={testOllama.ok ? 'text-success' : 'text-error'}>{testOllama.msg}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* OpenClaw */}
      <div className="settings-section">
        <h2 className="settings-section-title">🦅 OpenClaw Integration</h2>
        <div className="settings-grid">
          <div className="form-field">
            <label className="form-label">OpenClaw Gateway Port</label>
            <input className="text-input" type="number" value={settings.openclawPort} onChange={e => set('openclawPort', parseInt(e.target.value))} />
            <div className="field-note">Default: 18789 (configured in openclaw.json)</div>
          </div>
          <div className="form-field">
            <label className="form-label">Gateway Auth Token</label>
            <input className="text-input" type="password" value={settings.openclawToken} onChange={e => set('openclawToken', e.target.value)} placeholder="Paste your OpenClaw gateway token" />
            <div className="field-note">Found in your openclaw.json under gateway.auth.token</div>
          </div>
          <div className="form-field">
            <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
              <button className="btn-secondary btn-sm" onClick={testOpenClawConn} disabled={testOpenClawLoading}>
                {testOpenClawLoading ? '⏳' : '🔍 Test OpenClaw'}
              </button>
              {testOpenClaw && <span className={testOpenClaw.ok ? 'text-success' : 'text-error'}>{testOpenClaw.msg}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Defaults */}
      <div className="settings-section">
        <h2 className="settings-section-title">🎛️ Defaults</h2>
        <div className="settings-grid">
          <div className="form-field">
            <label className="form-label">Default Page on Startup</label>
            <select className="select-input" value={settings.defaultPage} onChange={e => set('defaultPage', e.target.value)}>
              <option value="dashboard">Dashboard</option>
              <option value="chat">Chat Studio</option>
              <option value="models">Model Registry</option>
              <option value="api-explorer">API Explorer</option>
            </select>
          </div>
        </div>
      </div>

      {/* Shell Safety */}
      <div className="settings-section">
        <h2 className="settings-section-title">🔐 Shell Safety</h2>
        <div className="settings-grid">
          <div className="form-field">
            <label className="form-label">Shell Execution Policy</label>
            <select className="select-input" value={settings.shellSafety} onChange={e => set('shellSafety', e.target.value)}>
              <option value="approval">Require Approval (Recommended)</option>
              <option value="session">Allow for Session</option>
              <option value="always">Always Allow (Dangerous)</option>
              <option value="deny">Always Deny</option>
            </select>
          </div>
          <div className="form-field">
            <label className="checkbox-label">
              <input type="checkbox" checked={settings.legacyShellTags} onChange={e => set('legacyShellTags', e.target.checked)} />
              <span>Enable legacy &lt;shell&gt; tag auto-execution (not recommended)</span>
            </label>
            <div className="field-note warning-note">⚠️ Enabling this allows AI to auto-run shell commands without approval.</div>
          </div>
        </div>
      </div>

      {/* MCP Server */}
      <div className="settings-section">
        <h2 className="settings-section-title">🧩 MCP Server</h2>
        <div className="settings-grid">
          <div className="form-field">
            <label className="form-label">MCP Server Command</label>
            <input
              className="text-input"
              value={settings.mcpServerCommand}
              onChange={e => set('mcpServerCommand', e.target.value)}
              placeholder="Example: npx -y @modelcontextprotocol/server-filesystem ."
            />
            <div className="field-note">Command used by the local backend to start your MCP server process.</div>
          </div>
          <div className="form-field">
            <label className="form-label">MCP Working Directory (optional)</label>
            <input
              className="text-input"
              value={settings.mcpServerCwd}
              onChange={e => set('mcpServerCwd', e.target.value)}
              placeholder="Example: C:\\Users\\you\\Documents"
            />
          </div>
          <div className="form-field">
            <label className="checkbox-label">
              <input type="checkbox" checked={!!settings.mcpAutoStart} onChange={e => set('mcpAutoStart', e.target.checked)} />
              <span>Auto-start MCP server when backend starts</span>
            </label>
          </div>
          <div className="form-field">
            <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
              <button className="btn-secondary btn-sm" onClick={refreshMcp} disabled={mcpLoading}>
                {mcpLoading ? '⏳' : '🔄 Refresh'}
              </button>
              <button className="btn-primary btn-sm" onClick={startMcp} disabled={mcpLoading || !settings.mcpServerCommand.trim()}>
                ▶ Start MCP
              </button>
              <button className="btn-ghost btn-sm" onClick={stopMcp} disabled={mcpLoading || !mcpStatus?.running}>
                ⏹ Stop MCP
              </button>
              {mcpStatus && (
                <span className={mcpStatus.running ? 'text-success' : 'text-secondary'}>
                  {mcpStatus.running
                    ? `✅ Running (pid ${mcpStatus.pid})`
                    : (mcpStatus.lastError ? `❌ ${mcpStatus.lastError}` : 'Idle')}
                </span>
              )}
            </div>
          </div>
          <div className="form-field" style={{gridColumn:'1 / -1'}}>
            <label className="form-label">Recent MCP Logs</label>
            <pre className="approval-pre" style={{maxHeight:'180px',overflow:'auto'}}>{mcpLogs.length ? mcpLogs.join('\n') : 'No logs yet.'}</pre>
          </div>
        </div>
      </div>

      {/* Data */}
      <div className="settings-section">
        <h2 className="settings-section-title">💾 Data</h2>
        <div className="settings-grid">
          {appInfo && (
            <div className="form-field">
              <label className="form-label">Data Directory</label>
              <code className="data-dir-display">{appInfo.dataDir}</code>
            </div>
          )}
          <div className="form-field">
            <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
              <button className="btn-secondary btn-sm" onClick={exportData}>📤 Export All Data</button>
              <button className="btn-ghost btn-sm" onClick={copyDiagnostics}>🔧 Copy Diagnostic Bundle</button>
            </div>
          </div>
        </div>
      </div>

      {/* Memory & Retention */}
      <div className="settings-section">
        <h2 className="settings-section-title">🧠 Memory &amp; Retention</h2>
        <WorkspaceMemorySettings workspaceId={activeWorkspace?.id} />
      </div>

      {/* About */}
      <div className="settings-section">
        <h2 className="settings-section-title">ℹ️ About</h2>
        <div className="about-card">
          {appInfo && (
            <>
              <div className="about-row"><span>Version</span><span>BTCMACHINE v{appInfo.version}</span></div>
              <div className="about-row"><span>Node.js</span><span>{appInfo.node}</span></div>
              <div className="about-row"><span>Platform</span><span>{appInfo.platform}</span></div>
              <div className="about-row"><span>Mode</span><span>{typeof window !== 'undefined' && window.electronAPI ? 'Electron Desktop' : 'Browser'}</span></div>
            </>
          )}
          <div className="about-row">
            <span>GitHub</span>
            <a href="https://github.com/resilient1ne1988/OLLAMAUI" className="link" target="_blank" rel="noreferrer">resilient1ne1988/OLLAMAUI</a>
          </div>
        </div>
      </div>
    </div>
  )
}
