import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * A stray or missing brace in a stylesheet does not fail the build (the minifier forgives it), but the browser then drops every rule after it.
 * This once hid the End-title and reveal-card fixes after a merge. These checks keep the stylesheets well formed.
 */
const FILES = ['src/ui/styles.css', 'src/scene/scene.css']
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""')

describe('the stylesheets', () => {
  it.each(FILES)('%s has balanced braces and never closes more than it opens', (file) => {
    const css = strip(readFileSync(file, 'utf8'))
    let depth = 0
    for (const ch of css) {
      if (ch === '{') depth++
      if (ch === '}') depth--
      expect(depth, `${file} closes a brace that was never opened`).toBeGreaterThanOrEqual(0)
    }
    expect(depth, `${file} leaves ${depth} brace(s) open`).toBe(0)
  })

  it.each(FILES)('%s has no conflict markers left from a merge', (file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(/^(<{7}|={7}|>{7})( |$)/m)
  })

  it('keeps the rules that stop the cue chip covering the End title and the reveal card spilling', () => {
    const css = strip(readFileSync('src/ui/styles.css', 'utf8'))
    expect(css).toContain('.app.end > h2')
    expect(css).toContain('minmax(0, 1fr) auto minmax(0, 1fr)')
    expect(css).toContain('.gear-sheet')
  })
})
