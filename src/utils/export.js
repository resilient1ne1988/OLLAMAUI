export function exportChatAsMarkdown(messages, sessionName = 'chat') {
  const lines = [`# ${sessionName}`, `*Exported: ${new Date().toLocaleString()}*`, '']
  messages.forEach(m => {
    lines.push(`## ${m.role === 'user' ? '👤 User' : '🤖 Assistant'}`)
    lines.push(m.content || '')
    lines.push('')
  })
  downloadText(lines.join('\n'), `${sessionName}.md`, 'text/markdown')
}
export function exportJSON(data, filename) {
  downloadText(JSON.stringify(data, null, 2), filename, 'application/json')
}
export function copyCurl(endpoint, method, body) {
  const bodyPart = body ? ` -d '${JSON.stringify(body)}'` : ''
  return `curl -X ${method} http://localhost:3838${endpoint} -H "Content-Type: application/json"${bodyPart}`
}
export function copyPowerShell(endpoint, method, body) {
  const bodyPart = body ? `\n$body = '${JSON.stringify(body)}'\n` : ''
  return `${bodyPart}Invoke-RestMethod -Uri "http://localhost:3838${endpoint}" -Method ${method}${body ? ' -Body $body -ContentType "application/json"' : ''}`
}
function downloadText(text, filename, type) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
