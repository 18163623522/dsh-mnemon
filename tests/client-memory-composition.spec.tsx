// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { MemoryCompositionPluginPage, MemoryCompositionSections } from '../src/client/MemoryComposition.tsx'
import { translateEn, translateZh } from '../src/client/locales.ts'
import type { ClientConnectionHandle, MemoryPluginEntryView, MemoryViewConfigurationRequest, MemoryViewDashboard } from '../src/host/protocol.ts'

afterEach(cleanup)

function entry(entryId: string, packageName: string, roles: MemoryPluginEntryView['roles'], typeId: string, overrides: Partial<MemoryPluginEntryView> = {}): MemoryPluginEntryView {
  return {
    entryId, packageName, typeId, roles, label: { en: `${typeId} label`, 'zh-CN': `${typeId} 标签` },
    description: { en: `${typeId} description`, 'zh-CN': `${typeId} 说明` }, fields: [], provides: [], requires: [], requiredBy: [],
    enabled: roles.includes('strategy') && typeId === 'default-three-tier', active: roles.includes('strategy') && typeId === 'default-three-tier',
    writable: true, config: {}, ...overrides,
  }
}

const threeTier = entry('mnemon-strategy-default-three-tier', 'dsh-mnemon-strategy-default-three-tier', ['strategy'], 'default-three-tier')
const general = entry('mnemon-strategy-general', 'dsh-mnemon-strategy-general', ['strategy'], 'general')
const capture = entry('mnemon-strategy-auto-capture', 'dsh-mnemon-strategy-auto-capture', ['strategy-extension'], 'auto-capture')
const external = entry('focus', 'dsh-mnemon-strategy-focus', ['strategy-extension'], 'focus')

function fixture(entries: MemoryPluginEntryView[], options: { failApply?: boolean } = {}) {
  let dashboard: MemoryViewDashboard = {
    revision: 'view-1', writable: true, strategyTypeId: 'default-three-tier', entries, currentUnavailable: 'no-session',
    sources: [], diagnostics: [], pluginInstallation: { supported: false, reason: 'loader-unavailable', suggestions: [] },
  }
  const applied: MemoryViewConfigurationRequest[] = []
  const call = vi.fn(async (channel: string, endpoint: string, payload: unknown) => {
    if (channel === '/dsh-mnemon-view' && endpoint === 'dashboard') return { ok: true as const, value: structuredClone(dashboard) }
    if (channel === '/dsh-mnemon-view-settings' && endpoint === 'apply') {
      if (options.failApply) return { ok: false as const, error: { code: 'internal' as const, message: 'selected memory Strategy type is unavailable', details: {} } }
      const request = (payload as { configuration: MemoryViewConfigurationRequest }).configuration
      applied.push(request)
      dashboard = { ...dashboard, revision: 'view-2', strategyTypeId: request.strategyTypeId, entries: dashboard.entries.map(value => request.entries[value.entryId] === undefined
        ? value
        : { ...value, enabled: request.entries[value.entryId]!.enabled, active: request.entries[value.entryId]!.enabled }) }
      return { ok: true as const, value: { saved: true as const } }
    }
    return { ok: false as const, error: { code: 'internal' as const, message: `unsupported ${channel} ${endpoint}`, details: {} } }
  })
  return { applied, connection: { rpc: { call }, isLoopback: true } as ClientConnectionHandle }
}

describe('memory composition controls', () => {
  it('switches the mutually exclusive main Strategy in one View transaction', async () => {
    const { applied, connection } = fixture([threeTier, general, capture])
    render(<MemoryCompositionSections connection={connection} language="en" t={translateEn} />)
    const next = await screen.findByRole('radio', { name: 'General' })
    expect((screen.getByRole('radio', { name: 'Default three-tier' }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(next)
    await waitFor(() => expect((screen.getByRole('radio', { name: 'General' }) as HTMLInputElement).checked).toBe(true))
    expect(applied).toEqual([{ expectedRevision: 'view-1', strategyTypeId: 'general', entries: {
      'mnemon-strategy-general': { enabled: true, config: {} },
      'mnemon-strategy-default-three-tier': { enabled: false, config: {} },
    } }])
    expect(screen.queryByText(translateEn('config.strategyInactive'))).toBeNull()
  })

  it('keeps the previous choice when the switch is rejected', async () => {
    const { connection } = fixture([threeTier, general], { failApply: true })
    render(<MemoryCompositionSections connection={connection} language="en" t={translateEn} />)
    fireEvent.click(await screen.findByRole('radio', { name: 'General' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', translateEn('config.strategyFailed'))
    expect((screen.getByRole('radio', { name: 'Default three-tier' }) as HTMLInputElement).checked).toBe(true)
  })

  it('shows no main Strategy choice while only one is installed', async () => {
    const { connection } = fixture([threeTier, capture])
    render(<MemoryCompositionSections connection={connection} language="zh" t={translateZh} />)
    expect(await screen.findByRole('checkbox', { name: '主动记录' })).toBeTruthy()
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })

  it('labels installed third-party enhancements with their own text in the active language', async () => {
    const { connection } = fixture([threeTier, external])
    const { unmount } = render(<MemoryCompositionSections connection={connection} language="zh-CN" t={translateZh} />)
    expect(await screen.findByRole('checkbox', { name: 'focus 标签' })).toBeTruthy()
    expect(screen.getByText('focus 说明')).toBeTruthy()
    unmount()
    render(<MemoryCompositionSections connection={connection} language="en" t={translateEn} />)
    expect(await screen.findByRole('checkbox', { name: 'focus label' })).toBeTruthy()
  })

  it('reports a selected main Strategy that is not running', async () => {
    const { connection } = fixture([{ ...threeTier, enabled: false, active: false }, { ...general, enabled: true, active: true }])
    render(<MemoryCompositionSections connection={connection} language="en" t={translateEn} />)
    expect(await screen.findByRole('status')).toHaveProperty('textContent', translateEn('config.strategyInactive'))
  })

  it('renders the Plugins page section only for its page view', async () => {
    const { connection } = fixture([threeTier, general, capture])
    const locale = { getSnapshot: () => ({ active: 'en', locales: [], revision: 0 }), subscribe: () => () => {} } as unknown as LocaleRuntime
    const { container, rerender } = render(<MemoryCompositionPluginPage view="summary" connection={connection} localeRuntime={locale} t={translateEn} />)
    expect(container.innerHTML).toBe('')
    rerender(<MemoryCompositionPluginPage view="page" connection={connection} localeRuntime={locale} t={translateEn} />)
    expect(await screen.findByRole('radio', { name: 'General' })).toBeTruthy()
    expect(screen.getByText(translateEn('config.compositionPluginsHint'))).toBeTruthy()
  })
})
