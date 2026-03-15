export const api = {
  get: (path) => fetch(path).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() }),
  post: (path, body) => fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() }),
  delete: (path, body) => fetch(path, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() }),
  stream: async (path, body, onChunk, signal) => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    })
    if (!res.ok) throw new Error(res.statusText)
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      onChunk(decoder.decode(value, { stream: true }))
    }
  }
}
