export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
export function formatDate(ts) {
  if (!ts) return '—'
  try { return new Date(ts).toLocaleString() } catch { return String(ts) }
}
export function formatDuration(ms) {
  if (!ms) return '0ms'
  if (ms < 1000) return ms + 'ms'
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's'
  return Math.floor(ms / 60000) + 'm ' + Math.floor((ms % 60000) / 1000) + 's'
}
export function formatModelName(name) {
  if (!name) return ''
  return name.replace(/:latest$/, '')
}
export function timeAgo(ts) {
  if (!ts) return '—'
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago'
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago'
  return Math.floor(diff / 86400000) + 'd ago'
}
