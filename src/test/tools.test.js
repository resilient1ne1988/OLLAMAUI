import { describe, it, expect } from 'vitest'
import { TOOL_DEFINITIONS, TOOL_EXECUTORS } from '../tools/definitions'

describe('TOOL_DEFINITIONS', () => {
  it('exports an array', () => { expect(Array.isArray(TOOL_DEFINITIONS)).toBe(true) })
  it('has run_shell tool', () => { expect(TOOL_DEFINITIONS.find(t => t.function.name === 'run_shell')).toBeTruthy() })
  it('run_shell has required command parameter', () => {
    const tool = TOOL_DEFINITIONS.find(t => t.function.name === 'run_shell')
    expect(tool.function.parameters.required).toContain('command')
  })
})

describe('TOOL_EXECUTORS', () => {
  it('has run_shell executor', () => { expect(typeof TOOL_EXECUTORS.run_shell).toBe('function') })
})
