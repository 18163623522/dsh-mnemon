// @vitest-environment jsdom
import { useMemo } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MnemonClient } from '../src/client/api.ts'
import { MemoryCompositionSections } from '../src/client/MemoryComposition.tsx'
import { translateEn, translateZh, type MnemonTranslate } from '../src/client/locales.ts'
import { useViewStore } from '../src/client/view-store.ts'
import type { ClientConnectionHandle, MemoryPluginEntryView, MemoryViewConfigurationRequest, MemoryViewDashboard } from '../src/host/protocol.ts'

afterEach(cleanup)

/** The main Strategy selectors; each accessible name is the row title followed by the chosen Strategy. */
const mainSelectors = (title = 'Main strategy') => screen.queryAllByRole('button', { name: new RegExp(`^${title} `, 'u') })
function chooseMain(strategy: string, index = 0): void {
  fireEvent.click(mainSelectors()[index]!)
  fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(`^${strategy}`, 'u') }))
}
const checked = (element: HTMLElement) => element.getAttribute('aria-checked') === 'true'

function entry(entryId: string, packageName: string, roles: MemoryPluginEntryView['roles'], typeId: string | undefined, overrides: Partial<MemoryPluginEntryView> = {}): MemoryPluginEntryView {
  return {
    entryId, packageName, ...(typeId === undefined ? {} : { typeId }), roles, label: { en: `${typeId} label`, 'zh-CN': `${typeId} 标签` },
    description: { en: `${typeId} description`, 'zh-CN': `${typeId} 说明` }, fields: [], provides: [], requires: [], requiredBy: [],
    enabled: roles.includes('strategy') && typeId === 'default-three-tier', active: roles.includes('strategy') && typeId === 'default-three-tier',
    writable: true, config: {}, ...overrides,
  }
}

const threeTier = entry('mnemon-strategy-default-three-tier', 'dsh-mnemon-strategy-default-three-tier', ['strategy'], 'default-three-tier')
const general = entry('mnemon-strategy-general', 'dsh-mnemon-strategy-general', ['strategy'], 'general')
const capture = entry('mnemon-strategy-auto-capture', 'dsh-mnemon-strategy-auto-capture', ['strategy-extension'], 'auto-capture')
const external = entry('focus', 'dsh-mnemon-strategy-focus', ['strategy-extension'], 'focus')
const off = { enabled: false, active: false } as const
const on = { enabled: true, active: true } as const

function fixture(entries: MemoryPluginEntryView[], options: { failApply?: boolean; holdApply?: Promise<void> } = {}) {
  let dashboard: MemoryViewDashboard = {
    revision: 'view-1', writable: true, strategyTypeId: 'default-three-tier', entries, currentUnavailable: 'no-session',
    sources: [], diagnostics: [], pluginInstallation: { supported: false, reason: 'loader-unavailable', suggestions: [] },
  }
  const applied: MemoryViewConfigurationRequest[] = []
  const call = vi.fn(async (channel: string, endpoint: string, payload: unknown) => {
    if (channel === '/dsh-mnemon-view' && endpoint === 'dashboard') return { ok: true as const, value: structuredClone(dashboard) }
    if (channel === '/dsh-mnemon-view-settings' && endpoint === 'apply') {
      await options.holdApply
      if (options.failApply) return { ok: false as const, error: { code: 'internal' as const, message: 'selected memory Strategy type is unavailable', details: {} } }
      const request = (payload as { configuration: MemoryViewConfigurationRequest }).configuration
      // The Host's own answer to a write prepared against an older View.
      if (request.expectedRevision !== dashboard.revision) return { ok: false as const, error: { code: 'internal' as const, message: 'Memory plugin configuration changed; refresh before saving or previewing.', details: {} } }
      applied.push(request)
      dashboard = { ...dashboard, revision: `view-${Number(dashboard.revision.slice(5)) + 1}`, strategyTypeId: request.strategyTypeId, entries: dashboard.entries.map(value => request.entries[value.entryId] === undefined
        ? value
        : { ...value, enabled: request.entries[value.entryId]!.enabled, active: request.entries[value.entryId]!.enabled }) }
      return { ok: true as const, value: { saved: true as const } }
    }
    return { ok: false as const, error: { code: 'internal' as const, message: `unsupported ${channel} ${endpoint}`, details: {} } }
  })
  /** Another writer, such as a second window, changes the View. */
  const external = (strategyTypeId: string) => { dashboard = { ...dashboard, revision: 'view-9', strategyTypeId } }
  return { applied, external, call, connection: { rpc: { call }, isLoopback: true } as ClientConnectionHandle }
}

/** The configuration page's wiring: one View store, re-read when `refreshKey` moves. */
function Composition(props: { connection: ClientConnectionHandle; language: string; readOnly?: boolean; refreshKey?: number; t: MnemonTranslate }) {
  const client = useMemo(() => new MnemonClient(props.connection), [props.connection])
  const view = useViewStore(client, props.refreshKey ?? 0)
  return <MemoryCompositionSections store={view.store} state={view.state} language={props.language} readOnly={props.readOnly ?? false} t={props.t} />
}

describe('memory composition controls', () => {
  it('switches the mutually exclusive main Strategy in one View transaction', async () => {
    const { applied, connection } = fixture([threeTier, general, capture])
    render(<Composition connection={connection} language="en" t={translateEn} />)
    await waitFor(() => expect(mainSelectors()).toHaveLength(1))
    expect(mainSelectors()[0]!.textContent).toBe('Default three-tier')
    chooseMain('General')
    await waitFor(() => expect(mainSelectors()[0]!.textContent).toBe('General'))
    expect(applied).toEqual([{ expectedRevision: 'view-1', strategyTypeId: 'general', entries: {
      'mnemon-strategy-general': { enabled: true, config: {} },
      'mnemon-strategy-default-three-tier': { enabled: false, config: {} },
    } }])
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps the previous choice when the switch is rejected', async () => {
    const { connection } = fixture([threeTier, general], { failApply: true })
    render(<Composition connection={connection} language="en" t={translateEn} />)
    await waitFor(() => expect(mainSelectors()).toHaveLength(1))
    chooseMain('General')
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', translateEn('config.strategyFailed'))
    expect(mainSelectors()[0]!.textContent).toBe('Default three-tier')
  })

  it('shows no main Strategy choice while only one is installed', async () => {
    const { connection } = fixture([threeTier, capture])
    render(<Composition connection={connection} language="zh" t={translateZh} />)
    expect(await screen.findByRole('switch', { name: '主动记录' })).toBeTruthy()
    expect(mainSelectors('主策略')).toHaveLength(0)
  })

  it('labels installed third-party enhancements with their own text in the active language', async () => {
    const { connection } = fixture([threeTier, external])
    const { unmount } = render(<Composition connection={connection} language="zh-CN" t={translateZh} />)
    expect(await screen.findByRole('switch', { name: 'focus 标签' })).toBeTruthy()
    expect(screen.getByText('focus 说明')).toBeTruthy()
    unmount()
    render(<Composition connection={connection} language="en" t={translateEn} />)
    expect(await screen.findByRole('switch', { name: 'focus label' })).toBeTruthy()
  })

  it('says memory is off while no main Strategy runs, and turns the selected one back on', async () => {
    const { applied, connection } = fixture([{ ...threeTier, ...off }, { ...general, ...off }, capture])
    render(<Composition connection={connection} language="en" t={translateEn} />)
    const note = await screen.findByRole('alert')
    expect(note.textContent).toContain('The main strategy “Default three-tier” is off, so memory is not in use. Conversations continue without memory.')
    // Enhancements wait: the Host checks every write against the selected main Strategy.
    expect((screen.getByRole('switch', { name: 'Active capture' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Turn on “Default three-tier”' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(applied).toEqual([{ expectedRevision: 'view-1', strategyTypeId: 'default-three-tier', entries: { 'mnemon-strategy-default-three-tier': { enabled: true, config: {} } } }])
    expect((screen.getByRole('switch', { name: 'Active capture' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('names the main Strategy that composes in place of the selected one and offers both ways out', async () => {
    const { applied, connection } = fixture([{ ...threeTier, ...off }, { ...general, ...on }])
    render(<Composition connection={connection} language="zh" t={translateZh} />)
    const note = await screen.findByRole('status')
    expect(note.textContent).toContain('所选主策略“默认三层”已停用，记忆暂由“通用”组合。')
    expect(screen.getByRole('button', { name: '启用“默认三层”' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '改用“通用”' }))
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
    expect(applied).toEqual([{ expectedRevision: 'view-1', strategyTypeId: 'general', entries: { 'mnemon-strategy-general': { enabled: true, config: {} } } }])
    expect(mainSelectors('主策略')[0]!.textContent).toBe('通用')
  })

  it('turns off a second main Strategy that runs unused', async () => {
    const { applied, connection } = fixture([threeTier, { ...general, ...on }])
    render(<Composition connection={connection} language="en" t={translateEn} />)
    expect((await screen.findByRole('status')).textContent).toContain('Also running: “General”. Only the selected main strategy composes memory.')
    fireEvent.click(screen.getByRole('button', { name: 'Turn off “General”' }))
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
    expect(applied).toEqual([{ expectedRevision: 'view-1', strategyTypeId: 'default-three-tier', entries: { 'mnemon-strategy-general': { enabled: false, config: {} } } }])
  })

  it('names the component an enhancement needs and turns it on', async () => {
    const spaces = entry('mnemon-source-memory-spaces', 'dsh-mnemon-source-memory-spaces', ['source'], undefined, { ...off, provides: [{ id: 'source', exclusive: false }, { id: 'source.durable-evidence', exclusive: false }] })
    const needy = { ...capture, ...on, requires: ['source.durable-evidence'] }
    const { applied, connection } = fixture([threeTier, general, needy, spaces])
    render(<Composition connection={connection} language="en" t={translateEn} />)
    expect(await screen.findByText('Needs the “Memory Spaces” component.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Turn on “Memory Spaces”' }))
    await waitFor(() => expect(screen.queryByText('Needs the “Memory Spaces” component.')).toBeNull())
    expect(applied).toEqual([{ expectedRevision: 'view-1', strategyTypeId: 'default-three-tier', entries: { 'mnemon-source-memory-spaces': { enabled: true, config: {} } } }])
  })

  it('keeps the controls read-only with a configuration that cannot be saved', async () => {
    const { applied, connection } = fixture([threeTier, general, capture])
    render(<Composition connection={connection} language="en" readOnly t={translateEn} />)
    await waitFor(() => expect(mainSelectors()).toHaveLength(1))
    expect((mainSelectors()[0] as HTMLButtonElement).disabled).toBe(true)
    const toggle = screen.getByRole('switch', { name: 'Active capture' }) as HTMLButtonElement
    expect(toggle.disabled).toBe(true)
    fireEvent.click(toggle)
    expect(applied).toEqual([])
  })

  it('applies a switch once more over a change made elsewhere, keeping that change', async () => {
    const { applied, connection, external } = fixture([threeTier, { ...general, ...on }, capture])
    render(<Composition connection={connection} language="en" t={translateEn} />)
    const toggle = await screen.findByRole('switch', { name: 'Active capture' })
    // Another window, or the component list below, moves the View first.
    external('general')
    fireEvent.click(toggle)
    await waitFor(() => expect(checked(screen.getByRole('switch', { name: 'Active capture' }))).toBe(true))
    expect(applied).toEqual([{ expectedRevision: 'view-9', strategyTypeId: 'general', entries: { 'mnemon-strategy-auto-capture': { enabled: true, config: {} } } }])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('reports a write the Host still refuses after the retry', async () => {
    const { applied, connection } = fixture([threeTier, general, capture], { failApply: true })
    render(<Composition connection={connection} language="en" t={translateEn} />)
    fireEvent.click(await screen.findByRole('switch', { name: 'Active capture' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', translateEn('config.enhancementsFailed'))
    expect(checked(screen.getByRole('switch', { name: 'Active capture' }))).toBe(false)
    expect(applied).toEqual([])
  })

  it('stays usable when the switches it applies are announced while it writes', async () => {
    let release!: () => void
    const holdApply = new Promise<void>(resolve => { release = resolve })
    const { applied, connection } = fixture([threeTier, general, capture], { holdApply })
    const { rerender } = render(<Composition connection={connection} language="en" t={translateEn} />)
    fireEvent.click(await screen.findByRole('switch', { name: 'Active capture' }))
    // DSH's plugin manager announces the switch before the write returns.
    rerender(<Composition connection={connection} language="en" refreshKey={1} t={translateEn} />)
    release()
    await waitFor(() => expect(applied).toHaveLength(1))
    await waitFor(() => expect((screen.getByRole('switch', { name: 'Active capture' }) as HTMLButtonElement).disabled).toBe(false))
    expect(checked(screen.getByRole('switch', { name: 'Active capture' }))).toBe(true)
  })
})
