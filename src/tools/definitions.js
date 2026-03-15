// Ollama-native tool definitions passed in the `tools` array of every chat request.
// Models that support function calling will emit structured `tool_calls` instead of
// free-text tags — no regex parsing required.

export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'run_shell',
      description:
        'Execute a PowerShell command on this Windows machine and return stdout/stderr. ' +
        'Use for file operations, system info, running scripts, and any OS-level task.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The PowerShell command to execute (e.g. "Get-Date", "ls C:\\\\", "python script.py")'
          }
        },
        required: ['command']
      }
    }
  }
]

// Maps tool name → server endpoint config for execution
export const TOOL_EXECUTORS = {
  run_shell: async (args) => {
    const res = await fetch('/api/shell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: args.command })
    })
    if (!res.ok) throw new Error(`Shell API error: ${res.status}`)
    const data = await res.json()
    const parts = []
    if (data.stdout) parts.push(data.stdout)
    if (data.stderr) parts.push(`STDERR: ${data.stderr}`)
    if (parts.length === 0) parts.push(`(exit code ${data.exitCode})`)
    return { output: parts.join('\n'), exitCode: data.exitCode }
  }
}
