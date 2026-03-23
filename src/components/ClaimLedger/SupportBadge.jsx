import React from 'react'

const COLOR_MAP = {
  text_supported:  { bg: '#22c55e', color: '#fff', label: 'Text' },
  image_supported: { bg: '#a855f7', color: '#fff', label: 'Image' },
  audio_supported: { bg: '#3b82f6', color: '#fff', label: 'Audio' },
  tool_derived:    { bg: '#06b6d4', color: '#fff', label: 'Tool' },
  inferred:        { bg: '#6b7280', color: '#fff', label: 'Inferred' },
  contradicted:    { bg: '#ef4444', color: '#fff', label: 'Contradicted' },
  unsupported:     { bg: '#f59e0b', color: '#fff', label: 'Unsupported' },
}

const PILL_STYLE = {
  display: 'inline-block',
  fontSize: '0.7rem',
  padding: '2px 8px',
  borderRadius: '999px',
  fontWeight: 600,
  lineHeight: 1.4,
}

export default function SupportBadge({ type }) {
  const cfg = COLOR_MAP[type] || COLOR_MAP.inferred
  return (
    <span style={{ ...PILL_STYLE, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  )
}
