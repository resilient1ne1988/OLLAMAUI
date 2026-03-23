const textExtractor = require('./text')
const { updateExtractionStatus, addChunk } = require('../sources')

const extractors = {
  text: textExtractor,
  transcript: textExtractor,
  tool: textExtractor,
}

async function extractSource(source) {
  const extractor = extractors[source.modality]
  if (!extractor) {
    console.warn(`[extraction] No extractor for modality: ${source.modality}`)
    await updateExtractionStatus(source.id, 'failed')
    return []
  }
  try {
    await updateExtractionStatus(source.id, 'pending')
    const chunks = await extractor.extract(source)
    for (let i = 0; i < chunks.length; i++) {
      await addChunk({ sourceId: source.id, chunkIndex: i, text: chunks[i].text, metadata: chunks[i].metadata || {} })
    }
    await updateExtractionStatus(source.id, 'complete')
    return chunks
  } catch (e) {
    console.error(`[extraction] Failed for source ${source.id}:`, e.message)
    await updateExtractionStatus(source.id, 'failed')
    return []
  }
}

module.exports = { extractSource }
