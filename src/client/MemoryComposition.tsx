import { useCallback, useEffect, useId, useMemo, useRef, useState, type JSX } from 'react'
import type { ClientConnectionHandle } from '../host/protocol.ts'
import type { MemoryPluginEntryView, MemoryPluginPreference, MemoryViewDashboard } from '../host/view-protocol.ts'
import { MnemonClient } from './api.ts'
import { message } from './page-kit.tsx'
import css from './MnemonSettingsCard.module.css'
import type { MnemonKey, MnemonTranslate } from './locales.ts'
import { SelectRow, ToggleRow } from './settings-controls.tsx'

/** Shipped Strategy copy; any other installed Strategy shows its own descriptor text. */
const SHIPPED_COPY: Readonly<Record<string, { label: MnemonKey; hint: MnemonKey }>> = {
  'dsh-mnemon-strategy-default-three-tier': { label: 'config.strategyThreeTier', hint: 'config.strategyThreeTierHint' },
  'dsh-mnemon-strategy-general': { label: 'config.strategyGeneral', hint: 'config.strategyGeneralHint' },
  'dsh-mnemon-strategy-auto-capture': { label: 'config.enhancementCapture', hint: 'config.enhancementCaptureHint' },
  'dsh-mnemon-strategy-light-context': { label: 'config.enhancementLightContext', hint: 'config.enhancementLightContextHint' },
  'dsh-mnemon-strategy-scoped': { label: 'config.enhancementScoped', hint: 'config.enhancementScopedHint' },
}

const domId = (prefix: string, entryId: string): string => `${prefix}-${entryId.replace(/[^a-zA-Z0-9_-]/gu, '-')}`

/** The Host's answer when a View write was prepared against an older revision. */
const STALE_VIEW = /configuration changed/u

/** Keep each requested switch, over the configuration the Host holds now. */
function rebase(entries: Record<string, MemoryPluginPreference>, dashboard: MemoryViewDashboard): Record<string, MemoryPluginPreference> {
  return Object.fromEntries(Object.entries(entries).map(([entryId, preference]) => {
    const current = dashboard.entries.find(entry => entry.entryId === entryId)
    return [entryId, { enabled: preference.enabled, config: structuredClone(current?.config ?? preference.config) }]
  }))
}

export interface MemoryCompositionProps {
  connection?: ClientConnectionHandle
  sessionId?: string
  workspaceId?: string
  refreshKey?: number
  /** Active DSH locale id; it picks the language of a third-party descriptor. */
  language: string
  /** The configuration around these controls cannot be saved, such as a remote page without the management grant. */
  readOnly?: boolean
  t: MnemonTranslate
}

/**
 * The main Strategy choice (mutually exclusive) and the independent
 * enhancements, written through one View transaction. Hidden while the View
 * dashboard cannot be read.
 */
export function MemoryCompositionSections(props: MemoryCompositionProps): JSX.Element | null {
  // Per-instance ids keep each label, heading and radio group bound to its own controls.
  const instance = useId()
  const client = useMemo(() => props.connection === undefined
    ? undefined
    : new MnemonClient(props.connection, props.sessionId, props.workspaceId), [props.connection, props.sessionId, props.workspaceId])
  const [dashboard, setDashboard] = useState<MemoryViewDashboard | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>(client === undefined ? 'unavailable' : 'loading')
  const [working, setWorking] = useState<string | null>(null)
  const [failure, setFailure] = useState<'strategy' | 'enhancement' | 'refresh' | null>(null)
  const request = useRef(0)

  const load = useCallback(async (): Promise<void> => {
    if (client === undefined) {
      request.current += 1
      setDashboard(null)
      setState('unavailable')
      return
    }
    const ticket = request.current + 1
    request.current = ticket
    // A reload keeps the current controls on screen until the new state arrives.
    setState(current => current === 'ready' ? current : 'loading')
    try {
      const next = await client.viewDashboard()
      if (request.current !== ticket) return
      setDashboard(next)
      setState('ready')
      setFailure(null)
    } catch {
      if (request.current !== ticket) return
      setDashboard(null)
      setState('unavailable')
    }
  }, [client, props.refreshKey])

  useEffect(() => {
    void load()
    return () => { request.current += 1 }
  }, [load])

  if (state !== 'ready' || dashboard === null) return null
  const mains = dashboard.entries.filter(entry => entry.roles.includes('strategy') && entry.typeId !== undefined)
  const enhancements = dashboard.entries.filter(entry => entry.roles.includes('strategy-extension'))
  if (mains.length <= 1 && enhancements.length === 0) return null
  const selected = mains.find(entry => entry.typeId === dashboard.strategyTypeId)
  const disabled = working !== null || !dashboard.writable || props.readOnly === true
  const copy = (entry: MemoryPluginEntryView): { label: string; hint: string } => {
    const shipped = SHIPPED_COPY[entry.packageName]
    if (shipped !== undefined) return { label: props.t(shipped.label), hint: props.t(shipped.hint) }
    const zh = props.language.toLowerCase().startsWith('zh')
    return { label: zh ? entry.label['zh-CN'] : entry.label.en, hint: zh ? entry.description['zh-CN'] : entry.description.en }
  }

  const apply = async (key: string, kind: 'strategy' | 'enhancement', strategyTypeId: string, entries: Record<string, MemoryPluginPreference>): Promise<void> => {
    if (client === undefined || disabled) return
    const previous = dashboard
    const ticket = request.current + 1
    request.current = ticket
    setWorking(key)
    setFailure(null)
    setDashboard({ ...dashboard, strategyTypeId, entries: dashboard.entries.map(entry => entries[entry.entryId] === undefined
      ? entry
      : { ...entry, enabled: entries[entry.entryId]!.enabled }) })
    let base = previous
    try {
      for (let attempt = 0; ; attempt += 1) {
        try {
          await client.applyView({ expectedRevision: base.revision, strategyTypeId, entries: rebase(entries, base) })
          break
        } catch (reason) {
          // A save elsewhere (another group on this page, a component switch
          // below it, another window) moves the View revision. Apply the same
          // choice once more on top of what the Host holds now.
          const latest = attempt === 0 && STALE_VIEW.test(message(reason)) ? await client.viewDashboard().catch(() => undefined) : undefined
          if (latest === undefined || request.current !== ticket) throw reason
          base = latest
        }
      }
      try {
        const next = await client.viewDashboard()
        if (request.current !== ticket) return
        setDashboard(next)
      } catch {
        if (request.current !== ticket) return
        // The apply already committed. Preserve its visible value and prevent
        // another write with a stale revision until these controls reload.
        setDashboard(current => current === null ? current : { ...current, writable: false })
        setFailure('refresh')
      }
    } catch {
      if (request.current !== ticket) return
      setFailure(kind)
      // Show what the Host now holds; the rejected change may have met a newer revision.
      const current = await client.viewDashboard().catch(() => previous)
      if (request.current === ticket) setDashboard(current)
    } finally {
      if (request.current === ticket) setWorking(null)
    }
  }

  const choose = (entry: MemoryPluginEntryView): void => {
    if (entry.typeId === dashboard.strategyTypeId && entry.enabled) return
    void apply(entry.entryId, 'strategy', entry.typeId!, {
      [entry.entryId]: { enabled: true, config: structuredClone(entry.config) },
      // One main Strategy composes the View, so the previous one stops with the switch.
      ...(selected === undefined || selected.entryId === entry.entryId || !selected.enabled
        ? {}
        : { [selected.entryId]: { enabled: false, config: structuredClone(selected.config) } }),
    })
  }
  const toggle = (entry: MemoryPluginEntryView): void => {
    void apply(entry.entryId, 'enhancement', dashboard.strategyTypeId, { [entry.entryId]: { enabled: !entry.enabled, config: structuredClone(entry.config) } })
  }

  return <section className={`${css.section} ${css.enhancementsSection}`} aria-labelledby={`${instance}-strategy-heading`} aria-busy={working !== null}>
    <div className={css.sectionHeading}>
      <h2 id={`${instance}-strategy-heading`}>{props.t('config.strategySectionTitle')}</h2>
      <p>{props.t('config.strategySectionDescription')}</p>
    </div>
    <div className={css.rows}>
      {mains.length > 1 && <SelectRow id={domId(`${instance}-strategy`, 'main')} label={props.t('config.strategyTitle')} value={dashboard.strategyTypeId}
        disabled={disabled || !mains.some(entry => entry.writable)}
        onChange={typeId => { const entry = mains.find(candidate => candidate.typeId === typeId); if (entry !== undefined) choose(entry) }}
        options={mains.map(entry => {
          const text = copy(entry)
          return { value: entry.typeId!, label: text.label, detail: text.hint, ...(entry.writable ? {} : { disabled: true }) }
        })} />}
      {enhancements.map(entry => {
        const text = copy(entry)
        return <ToggleRow key={entry.entryId} id={domId(`${instance}-enhancement`, entry.entryId)} label={text.label} hint={text.hint}
          checked={entry.enabled} disabled={disabled || !entry.writable} onChange={() => toggle(entry)} />
      })}
    </div>
    {mains.length > 1 && (selected === undefined || !selected.active) && working === null && <p className={css.error} role="status">{props.t('config.strategyInactive')}</p>}
    {failure === 'strategy' && <p className={css.error} role="alert">{props.t('config.strategyFailed')}</p>}
    {(failure === 'enhancement' || failure === 'refresh') && <p className={css.error} role="alert">{props.t(failure === 'refresh' ? 'config.enhancementsRefreshFailed' : 'config.enhancementsFailed')}</p>}
  </section>
}
