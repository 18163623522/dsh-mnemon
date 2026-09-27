import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const settingsCss = readFileSync(new URL('../src/client/MnemonSettingsCard.module.css', import.meta.url), 'utf8')

describe('Settings layout invariants', () => {
  it('anchors the remaining visually hidden radios to their visible segments', () => {
    expect(settingsCss).toContain('.providerToggle { display: inline-flex; position: relative; cursor: pointer; }')
    expect(settingsCss).toContain('.inlineChoices label { position: relative; cursor: pointer; }')
    expect(settingsCss).toContain('.toggleRow {\n  display: flex;\n  position: relative;')
  })

  it('floats the unsaved-changes bar just above the bottom of the Plugins page scroller', () => {
    // The page scroller keeps 48px of bottom padding, which sticky insets respect.
    expect(settingsCss).toContain('position: sticky;\n  z-index: 2;\n  bottom: -32px;')
    expect(settingsCss).toContain('box-shadow: var(--dsw-elevation-prominent);')
  })

  it('keeps the added enhancement controls compact in a host-constrained mobile column', () => {
    expect(settingsCss).toContain('.enhancementsSection { container-type: inline-size; }')
    expect(settingsCss).toContain('@container (max-width: 180px)')
    expect(settingsCss).toContain('.enhancementsSection .settingCopy small { display: none; }')
    expect(settingsCss).toContain('.enhancementsSection .switch { justify-self: end; }')
  })
})
