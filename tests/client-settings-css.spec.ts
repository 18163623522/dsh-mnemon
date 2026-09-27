import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const settingsCss = readFileSync(new URL('../src/client/MnemonSettingsCard.module.css', import.meta.url), 'utf8')

describe('Settings layout invariants', () => {
  it('anchors the remaining visually hidden radios to their visible segments', () => {
    expect(settingsCss).toContain('.providerToggle { display: inline-flex; position: relative; cursor: pointer; }')
    expect(settingsCss).toContain('.inlineChoices label { position: relative; cursor: pointer; }')
    expect(settingsCss).toContain('.toggleRow {\n  display: flex;\n  position: relative;')
  })

  it('pins the unsaved-changes bar flush with the bottom of the host settings scroller', () => {
    expect(settingsCss).toContain('position: sticky;\n  z-index: 2;\n  bottom: -24px;')
    expect(settingsCss).toContain('padding: 12px 24px 36px;')
  })

  it('keeps the added enhancement controls compact in a host-constrained mobile column', () => {
    expect(settingsCss).toContain('.enhancementsSection { container-type: inline-size; }')
    expect(settingsCss).toContain('@container (max-width: 180px)')
    expect(settingsCss).toContain('.enhancementsSection .settingCopy small { display: none; }')
    expect(settingsCss).toContain('.enhancementsSection .switch { justify-self: end; }')
  })
})
