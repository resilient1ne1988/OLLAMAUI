'use strict';

const { randomUUID } = require('crypto');

const IMPACT_ORDER = { high: 3, medium: 2, low: 1 };

/**
 * analyzeSources(sources, userMessage) → CaptureSuggestion[]
 * Applies heuristics to produce 1–3 ranked suggestions.
 */
function analyzeSources(sources, userMessage) {
  const suggestions = [];
  const msg = (userMessage || '').toLowerCase();

  const modalities = sources.map(s => s.modality || '');
  const hasScreenshot = modalities.includes('screenshot');
  const hasImage = modalities.includes('image') || hasScreenshot;
  const hasAudio = modalities.includes('audio');
  const hasText = modalities.includes('text');
  const hasPdf = modalities.includes('pdf');
  const hasCsv = modalities.includes('csv');

  const allFailed = sources.length > 0 && sources.every(s => s.extractionStatus === 'failed');

  // Heuristic: no sources at all
  if (sources.length === 0) {
    suggestions.push(makeSuggestion({
      workspaceId: null,
      reason: 'No sources provided',
      suggestionText: 'Add a document, screenshot, or paste text to give the AI something to work with',
      recommendedModality: 'text',
      expectedImpact: 'high',
      relatedSourceIds: [],
    }));
  }

  // Heuristic: all sources failed extraction
  if (allFailed) {
    suggestions.push(makeSuggestion({
      reason: 'All sources failed extraction',
      suggestionText: 'Re-upload files in a supported format',
      recommendedModality: 'pdf',
      expectedImpact: 'high',
      relatedSourceIds: sources.map(s => s.id),
    }));
  }

  // Heuristic: screenshot + object identification request
  if (hasScreenshot || hasImage) {
    const objectWords = ['identify', 'what is', 'recognize', 'detect', 'find', 'show', 'label', 'serial', 'model'];
    if (objectWords.some(w => msg.includes(w))) {
      suggestions.push(makeSuggestion({
        reason: 'Screenshot with object identification request',
        suggestionText: 'Try a higher-resolution close-up image for better identification accuracy',
        recommendedModality: 'image',
        expectedImpact: 'medium',
        relatedSourceIds: sources.filter(s => s.modality === 'screenshot' || s.modality === 'image').map(s => s.id),
      }));
    }
  }

  // Heuristic: screenshot + table/calculation request
  if (hasScreenshot || hasImage) {
    const tableWords = ['table', 'spreadsheet', 'calculate', 'sum', 'total', 'csv', 'data', 'chart', 'graph', 'number'];
    if (tableWords.some(w => msg.includes(w))) {
      suggestions.push(makeSuggestion({
        reason: 'Screenshot with table/calculation request',
        suggestionText: 'Upload the CSV or spreadsheet file instead of a screenshot for accurate data extraction',
        recommendedModality: 'csv',
        expectedImpact: 'high',
        relatedSourceIds: sources.filter(s => s.modality === 'screenshot' || s.modality === 'image').map(s => s.id),
      }));
    }
  }

  // Heuristic: audio only + speaker-specific request
  if (hasAudio && !hasText && !hasPdf && !hasCsv) {
    const speakerWords = ['who said', 'speaker', 'person', 'participant', 'voice', 'name', 'transcript'];
    if (speakerWords.some(w => msg.includes(w))) {
      suggestions.push(makeSuggestion({
        reason: 'Audio with speaker-specific request',
        suggestionText: 'Provide participant names or a transcript to improve speaker attribution',
        recommendedModality: 'text',
        expectedImpact: 'medium',
        relatedSourceIds: sources.filter(s => s.modality === 'audio').map(s => s.id),
      }));
    }
  }

  // Heuristic: text only + complex technical content
  if (hasText && !hasImage && !hasAudio && !hasPdf && !hasCsv) {
    const techWords = ['code', 'algorithm', 'formula', 'equation', 'diagram', 'architecture', 'technical', 'specification'];
    if (techWords.some(w => msg.includes(w))) {
      suggestions.push(makeSuggestion({
        reason: 'Text only with complex technical content',
        suggestionText: 'Add a PDF or formatted document for better structure and context',
        recommendedModality: 'pdf',
        expectedImpact: 'low',
        relatedSourceIds: sources.filter(s => s.modality === 'text').map(s => s.id),
      }));
    }
  }

  // Sort by impact descending, return at most 3
  return suggestions
    .sort((a, b) => (IMPACT_ORDER[b.expectedImpact] || 0) - (IMPACT_ORDER[a.expectedImpact] || 0))
    .slice(0, 3);
}

function makeSuggestion({ reason, suggestionText, recommendedModality, expectedImpact, relatedSourceIds }) {
  return {
    id: randomUUID(),
    workspaceId: null, // set by caller if needed
    reason,
    suggestionText,
    recommendedModality,
    expectedImpact,
    relatedSourceIds: relatedSourceIds || [],
    dismissed: false,
  };
}

module.exports = { analyzeSources };
