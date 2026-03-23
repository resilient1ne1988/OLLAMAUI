const fs = require('fs')
const path = require('path')

const CHUNK_SIZE = 1500
const CHUNK_OVERLAP = 200

function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + size, text.length)
    chunks.push({ text: text.slice(start, end).trim(), metadata: { charStart: start, charEnd: end } })
    start += size - overlap
    if (start >= text.length) break
  }
  return chunks.filter(c => c.text.length > 0)
}

async function extract(source) {
  let rawText = ''
  if (source.localPath && fs.existsSync(source.localPath)) {
    rawText = fs.readFileSync(source.localPath, 'utf8')
  } else if (source.metadata && source.metadata.content) {
    rawText = String(source.metadata.content)
  } else {
    throw new Error('No readable content for text extraction')
  }
  return chunkText(rawText)
}

module.exports = { extract, chunkText }
