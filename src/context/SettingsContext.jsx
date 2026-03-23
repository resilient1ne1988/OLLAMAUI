import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

const SettingsContext = createContext(null)

const DEFAULTS = {
  ollamaUrl: 'http://localhost:11434',
  openclawUrl: 'http://localhost:18789',
  openclawToken: '',
  openclawPort: 18789,
  defaultModel: '',
  defaultPage: 'dashboard',
  shellSafety: 'approval',
  legacyShellTags: false,
  mcpServerCommand: 'node server/index.js',
  mcpServerCwd: 'c:\\Users\\keith\\Documents\\OLLAMAUI',
  mcpAutoStart: false,
  dataDir: '',
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  const reloadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings')
      if (!res.ok) return
      const data = await res.json()
      const merged = { ...DEFAULTS, ...data }
      setSettings(merged)
      setLoaded(true)
      // Auto-save defaults for any missing MCP fields on first run
      if (!data.mcpServerCommand || !data.mcpServerCwd) {
        const patch = { ...merged }
        if (!data.mcpServerCommand) patch.mcpServerCommand = DEFAULTS.mcpServerCommand
        if (!data.mcpServerCwd) patch.mcpServerCwd = DEFAULTS.mcpServerCwd
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch)
        }).catch(() => {})
      }
    } catch { setLoaded(true) }
  }, [])

  useEffect(() => { reloadSettings() }, [reloadSettings])

  const saveSettings = useCallback(async (patch) => {
    const merged = { ...settings, ...patch }
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged)
      })
      if (!res.ok) return merged
      const data = await res.json()
      const confirmed = data.settings || merged
      setSettings(confirmed)
      return confirmed
    } catch {
      setSettings(merged)
      return merged
    }
  }, [settings])

  return (
    <SettingsContext.Provider value={{ settings, loaded, saveSettings, reloadSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider')
  return ctx
}