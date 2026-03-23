'use strict'

const PLACEHOLDER_ELLIPSIS = '\x00EL\x00'
const PLACEHOLDER_DOT = '\x00DT\x00'

/**
 * Protect tokens that contain dots but are NOT sentence boundaries.
 */
function protect(text) {
  return text
    .replace(/\.{2,}/g, PLACEHOLDER_ELLIPSIS)          // ellipsis
    .replace(/(\d)\.(\d)/g, `$1${PLACEHOLDER_DOT}$2`)  // decimal numbers
}

function restore(text) {
  return text
    .replace(new RegExp(PLACEHOLDER_ELLIPSIS, 'g'), '...')
    .replace(new RegExp(PLACEHOLDER_DOT, 'g'), '.')
}

/**
 * Split text into atomic claim sentences.
 * Splits on `. `, `! `, `? ` that are followed by an uppercase letter or quote,
 * while preserving ellipsis and decimal numbers.
 *
 * @param {string} text
 * @param {string} messageId
 * @returns {Array<{ messageId, text, supportTypes, evidenceRefs, contradictionRefs, regenerateEligible }>}
 */
function segmentIntoClaims(text, messageId) {
  if (!text || !text.trim()) return []

  const safe = protect(text)
  const parts = []
  let current = ''

  for (let i = 0; i < safe.length; i++) {
    const c = safe[i]
    current += c

    const isPunct = c === '.' || c === '!' || c === '?'
    const nextIsSpace = i + 1 < safe.length && safe[i + 1] === ' '
    const afterSpace = i + 2 < safe.length ? safe[i + 2] : ''
    const nextWordIsCapOrQuote = /[A-Z"'(]/.test(afterSpace)

    if (isPunct && nextIsSpace && (nextWordIsCapOrQuote || i + 2 >= safe.length)) {
      const sentence = restore(current.trim())
      if (sentence.length > 5) parts.push(sentence)
      current = ''
      i++ // skip the space
    }
  }

  const remainder = restore(current.trim())
  if (remainder.length > 5) parts.push(remainder)

  return parts.map(sentence => ({
    messageId,
    text: sentence,
    supportTypes: ['inferred'],
    evidenceRefs: [],
    contradictionRefs: [],
    regenerateEligible: true,
  }))
}

/**
 * Classify claims by comparing against available source chunks.
 * - No sources at all → `unsupported`
 * - Keyword overlap ratio ≥ 0.3 → `text_supported`
 * - Sources exist but low overlap → `inferred`
 *
 * @param {Array} claims   Array of claim objects from segmentIntoClaims
 * @param {Array} sources  Array of source chunk objects (with .content / .text / .excerpt)
 * @returns {Array} New array of claims with updated supportTypes
 */
function classifyClaims(claims, sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return claims.map(c => ({ ...c, supportTypes: ['unsupported'] }))
  }

  // Flatten all source text into one lower-cased blob for overlap scoring
  const sourceText = sources
    .map(s => (s.content || s.text || s.excerpt || s.chunk || '').toLowerCase())
    .join(' ')

  return claims.map(claim => {
    const words = claim.text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 4)

    if (words.length === 0) return { ...claim, supportTypes: ['inferred'] }

    const matchCount = words.filter(w => sourceText.includes(w)).length
    const ratio = matchCount / words.length

    const supportType = ratio >= 0.3 ? 'text_supported' : 'inferred'
    return { ...claim, supportTypes: [supportType] }
  })
}

module.exports = { segmentIntoClaims, classifyClaims }
