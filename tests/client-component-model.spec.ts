import { describe, expect, it } from 'vitest'
import { componentModel, enhancementApplies, sourceOf, unmetRequirements } from '../src/client/component-model.ts'
import type { MemoryPluginEntryView, MemoryViewDashboard } from '../src/host/view-protocol.ts'

function entry(entryId: string, roles: MemoryPluginEntryView['roles'], overrides: Partial<MemoryPluginEntryView> = {}): MemoryPluginEntryView {
  return {
    entryId, packageName: 'dsh-mnemon-' + entryId, roles, label: { en: entryId, 'zh-CN': entryId }, description: { en: '', 'zh-CN': '' },
    fields: [], provides: [], requires: [], requiredBy: [], enabled: true, active: true, writable: true, config: {}, ...overrides,
  }
}

function dashboard(entries: MemoryPluginEntryView[], strategyTypeId = 'default-three-tier'): MemoryViewDashboard {
  return { revision: 'r1', writable: true, strategyTypeId, entries, sources: [], diagnostics: [], pluginInstallation: { supported: false, suggestions: [] } }
}

const main = (typeId: string, overrides: Partial<MemoryPluginEntryView> = {}) => entry('strategy-' + typeId, ['strategy'], { typeId, provides: [{ id: 'strategy', exclusive: false }], ...overrides })
const off = { enabled: false, active: false }

describe('memory component model', () => {
  it('composes with the selected main Strategy and marks the others as idle', () => {
    const model = componentModel(dashboard([main('default-three-tier'), main('general')]))
    expect(model.composing?.typeId).toBe('default-three-tier')
    expect(model.idle.map(value => value.typeId)).toEqual(['general'])
    expect(model.contenders).toEqual([])
  })

  it('falls back to the only running main Strategy, as the Host does', () => {
    const model = componentModel(dashboard([main('default-three-tier', off), main('general')]))
    expect(model.selected?.typeId).toBe('default-three-tier')
    expect(model.composing?.typeId).toBe('general')
    expect(model.idle).toEqual([])
  })

  it('composes with nothing while several others run and the selected one does not', () => {
    const model = componentModel(dashboard([main('default-three-tier', off), main('general'), main('focus')]))
    expect(model.composing).toBeUndefined()
    expect(model.contenders.map(value => value.typeId)).toEqual(['general', 'focus'])
  })

  it('composes with nothing while no main Strategy runs', () => {
    const model = componentModel(dashboard([main('default-three-tier', off), main('general', off)]))
    expect(model.composing).toBeUndefined()
    expect(model.contenders).toEqual([])
    // An entry that is on but has not registered does not compose either.
    expect(componentModel(dashboard([main('default-three-tier', { active: false })])).composing).toBeUndefined()
  })

  it('finds the Source of a memory layer, including a shipped one that is off and has no type', () => {
    const documents = entry('source-documents', ['source'], { typeId: 'documents' })
    const spaces = entry('source-memory-spaces', ['source'], off)
    const value = dashboard([documents, spaces])
    expect(sourceOf(value, 'documents')).toBe(documents)
    expect(sourceOf(value, 'memory-spaces')).toBe(spaces)
    expect(sourceOf(value, 'runtime')).toBeUndefined()
  })

  it('names the requirements no switched-on component provides, with the ones that could', () => {
    const spaces = entry('source-memory-spaces', ['source'], { ...off, provides: [{ id: 'source.durable-evidence', exclusive: false }] })
    const capture = entry('strategy-auto-capture', ['strategy-extension'], { requires: ['strategy', 'source.durable-evidence'] })
    const value = dashboard([main('default-three-tier'), capture, spaces])
    expect(unmetRequirements(value, capture)).toEqual([{ requirement: 'source.durable-evidence', providers: [spaces] }])
    expect(unmetRequirements(dashboard([main('default-three-tier'), capture]), capture)).toEqual([{ requirement: 'source.durable-evidence', providers: [] }])
  })

  it('applies an enhancement to the Strategy it targets or to any Strategy', () => {
    const composing = main('general')
    expect(enhancementApplies(entry('any', ['strategy-extension'], { strategyTypeId: '*' }), composing)).toBe(true)
    expect(enhancementApplies(entry('general-only', ['strategy-extension'], { strategyTypeId: 'general' }), composing)).toBe(true)
    expect(enhancementApplies(entry('three-tier-only', ['strategy-extension'], { strategyTypeId: 'default-three-tier' }), composing)).toBe(false)
    expect(enhancementApplies(entry('any', ['strategy-extension']), undefined)).toBe(false)
  })
})
