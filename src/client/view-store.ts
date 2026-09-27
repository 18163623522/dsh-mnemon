import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { MemoryPluginEntryView, MemoryPluginPreference, MemoryViewDashboard } from '../host/view-protocol.ts'
import type { MnemonClient } from './api.ts'
import { message } from './page-kit.tsx'

/** The memory components and main Strategy choice as the configuration page shows them. */
export interface MnemonViewState {
  status: 'loading' | 'ready' | 'unavailable'
  dashboard: MemoryViewDashboard | null
  /** The control whose write is crossing the wire. */
  working: string | null
  /** The last write that did not land, or a reload that failed after one did. */
  failure: { key: string; kind: 'apply' | 'refresh' } | null
}

/** The Host's answer when a View write was prepared against an older revision. */
const STALE_VIEW = /configuration changed/u

/** Keep each requested switch, over the configuration the Host holds now. */
function rebase(entries: Record<string, MemoryPluginPreference>, dashboard: MemoryViewDashboard): Record<string, MemoryPluginPreference> {
  return Object.fromEntries(Object.entries(entries).map(([entryId, preference]) => {
    const current = dashboard.entries.find(entry => entry.entryId === entryId)
    return [entryId, { enabled: preference.enabled, config: structuredClone(current?.config ?? preference.config) }]
  }))
}

/**
 * One reader and writer of the View dashboard for the configuration page, so
 * the Strategy, memory layer and Provider groups show the same component
 * states and switch components through one revision-fenced write.
 */
export class MnemonViewStore {
  private state: MnemonViewState
  private readonly listeners = new Set<() => void>()
  private ticket = 0

  constructor(private readonly client: MnemonClient | undefined) {
    this.state = { status: client === undefined ? 'unavailable' : 'loading', dashboard: null, working: null, failure: null }
  }

  readonly getSnapshot = (): MnemonViewState => this.state

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Re-read the dashboard, keeping the current one on screen until the answer arrives. */
  async load(): Promise<void> {
    // A write re-reads when it finishes, after every change it caused, such
    // as the plugin manager's own announcement of the switches it applied.
    if (this.client === undefined || this.state.working !== null) return
    const ticket = ++this.ticket
    if (this.state.status !== 'ready') this.publish({ ...this.state, status: 'loading' })
    try {
      const dashboard = await this.client.viewDashboard()
      if (ticket === this.ticket) this.publish({ ...this.state, status: 'ready', dashboard, failure: null })
    } catch {
      if (ticket === this.ticket) this.publish({ ...this.state, status: 'unavailable', dashboard: null })
    }
  }

  /**
   * Switch components and choose the main Strategy in one View write. The
   * change shows at once and reverts to the Host's state if refused; a write
   * that met a change made elsewhere is applied once more on top of it.
   * @param strategyTypeId the main Strategy to choose; omitted, the write keeps the one the Host holds.
   * @returns whether the Host accepted the write.
   */
  async apply(key: string, strategyTypeId: string | undefined, entries: Record<string, MemoryPluginPreference>): Promise<boolean> {
    const previous = this.state.dashboard
    if (this.client === undefined || previous === null || this.state.working !== null) return false
    const ticket = ++this.ticket
    this.publish({
      ...this.state, working: key, failure: null,
      // Shown as if the switches already took effect, so the page does not
      // flash the state between the old and the new configuration.
      dashboard: { ...previous, strategyTypeId: strategyTypeId ?? previous.strategyTypeId, entries: previous.entries.map(entry => entries[entry.entryId] === undefined
        ? entry
        : { ...entry, enabled: entries[entry.entryId]!.enabled, active: entries[entry.entryId]!.enabled }) },
    })
    let base = previous
    try {
      for (let attempt = 0; ; attempt += 1) {
        try {
          await this.client.applyView({ expectedRevision: base.revision, strategyTypeId: strategyTypeId ?? base.strategyTypeId, entries: rebase(entries, base) })
          break
        } catch (reason) {
          // Another save moves the View revision: a group on this page, a
          // switch on DSH's list below it, another window. Apply the same
          // choice once more on top of what the Host holds now.
          const latest = attempt === 0 && STALE_VIEW.test(message(reason)) ? await this.client.viewDashboard().catch(() => undefined) : undefined
          if (latest === undefined || ticket !== this.ticket) throw reason
          base = latest
        }
      }
    } catch {
      if (ticket !== this.ticket) return false
      // Show what the Host now holds; the refused write may have met a newer revision.
      const current = await this.client.viewDashboard().catch(() => previous)
      if (ticket === this.ticket) this.publish({ ...this.state, dashboard: current, working: null, failure: { key, kind: 'apply' } })
      return false
    }
    try {
      const next = await this.client.viewDashboard()
      if (ticket === this.ticket) this.publish({ ...this.state, status: 'ready', dashboard: next, working: null })
    } catch {
      // The write committed. Keep its visible value and refuse another write
      // with a stale revision until the page reloads.
      if (ticket === this.ticket) this.publish({ ...this.state, dashboard: this.state.dashboard === null ? null : { ...this.state.dashboard, writable: false }, working: null, failure: { key, kind: 'refresh' } })
    }
    return true
  }

  /** Switch components on or off, keeping whichever main Strategy the Host holds. */
  setEnabled(key: string, changes: ReadonlyArray<{ entry: MemoryPluginEntryView; enabled: boolean }>): Promise<boolean> {
    return this.apply(key, undefined, Object.fromEntries(changes.map(({ entry, enabled }) => [entry.entryId, { enabled, config: structuredClone(entry.config) }])))
  }

  private publish(state: MnemonViewState): void {
    this.state = state
    for (const listener of [...this.listeners]) listener()
  }
}

/** The page's View store, re-read whenever `refreshKey` moves. */
export function useViewStore(client: MnemonClient | undefined, refreshKey: number): { store: MnemonViewStore; state: MnemonViewState } {
  const store = useMemo(() => new MnemonViewStore(client), [client])
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  useEffect(() => { void store.load() }, [store, refreshKey])
  return { store, state }
}
