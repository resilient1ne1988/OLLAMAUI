import { describe, it, expect } from 'vitest'
import { formatBytes, formatDate, formatDuration, timeAgo } from '../utils/format'

describe('formatBytes', () => {
  it('returns 0 B for falsy input', () => { expect(formatBytes(0)).toBe('0 B') })
  it('formats bytes correctly', () => { expect(formatBytes(1024)).toBe('1 KB') })
  it('formats megabytes', () => { expect(formatBytes(1024 * 1024)).toBe('1 MB') })
  it('formats gigabytes', () => { expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB') })
})

describe('formatDate', () => {
  it('returns dash for falsy', () => { expect(formatDate(null)).toBe('—') })
  it('returns string for valid timestamp', () => { expect(typeof formatDate(Date.now())).toBe('string') })
})

describe('timeAgo', () => {
  it('returns just now for recent', () => { expect(timeAgo(Date.now() - 1000)).toBe('just now') })
  it('returns minutes ago', () => { expect(timeAgo(Date.now() - 120000)).toMatch(/m ago/) })
})
