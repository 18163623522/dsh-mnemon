import { useId, type JSX, type ReactNode } from 'react'
import type { MemoryPluginEntryView, MemoryPluginPreference } from '../host/view-protocol.ts'
import css from './MnemonSettingsCard.module.css'
import type { MnemonKey, MnemonTranslate } from './locales.ts'
import { componentModel, enhancementApplies, unmetRequirements, type MemoryComponentModel } from './component-model.ts'
import { SelectRow, StateNote, ToggleRow } from './settings-controls.tsx'
import type { MnemonViewState, MnemonViewStore } from './view-store.ts'

/** Shipped component copy; any other installed component shows its own descriptor text. */
const SHIPPED_COPY: Readonly<Record<string, { label: MnemonKey; hint: MnemonKey }>> = {
  'dsh-mnemon-strategy-default-three-tier': { label: 'config.strategyThreeTier', hint: 'config.strategyThreeTierHint' },
  'dsh-mnemon-strategy-general': { label: 'config.strategyGeneral', hint: 'config.strategyGeneralHint' },
  'dsh-mnemon-strategy-auto-capture': { label: 'config.enhancementCapture', hint: 'config.enhancementCaptureHint' },
  'dsh-mnemon-strategy-light-context': { label: 'config.enhancementLightContext', hint: 'config.enhancementLightContextHint' },
  'dsh-mnemon-strategy-scoped': { label: 'config.enhancementScoped', hint: 'config.enhancementScopedHint' },
  'dsh-mnemon-source-runtime': { label: 'layers.runtimeLabel', hint: 'layers.runtimeDescription' },
  'dsh-mnemon-source-documents': { label: 'layers.documentsLabel', hint: 'layers.documentsDescription' },
  'dsh-mnemon-source-memory-spaces': { label: 'layers.memorySpacesLabel', hint: 'layers.memorySpacesDescription' },
}

const domId = (prefix: string, entryId: string): string => `${prefix}-${entryId.replace(/[^a-zA-Z0-9_-]/gu, '-')}`

/** A component's name and description in the page's language. */
export function componentCopy(entry: MemoryPluginEntryView, t: MnemonTranslate, language: string): { label: string; hint: string } {
  const shipped = SHIPPED_COPY[entry.packageName]
  if (shipped !== undefined) return { label: t(shipped.label), hint: t(shipped.hint) }
  const zh = language.toLowerCase().startsWith('zh')
  return { label: zh ? entry.label['zh-CN'] : entry.label.en, hint: zh ? entry.description['zh-CN'] : entry.description.en }
}

/** Quoted names joined in the page's language. */
export function nameList(names: readonly string[], t: MnemonTranslate): string {
  return names.map(name => t('config.quoted', { name })).join(t('config.listSeparator'))
}

/**
 * One main Strategy composes memory. Choosing one switches it on and every
 * other main Strategy off, so none keeps running unused.
 */
export function chooseMain(store: MnemonViewStore, model: MemoryComponentModel, entry: MemoryPluginEntryView): Promise<boolean> {
  const entries: Record<string, MemoryPluginPreference> = { [entry.entryId]: { enabled: true, config: structuredClone(entry.config) } }
  for (const other of model.mains) if (other !== entry && other.enabled) entries[other.entryId] = { enabled: false, config: structuredClone(other.config) }
  return store.apply('strategy:' + entry.entryId, entry.typeId!, entries)
}

export interface MemoryCompositionProps {
  store: MnemonViewStore
  state: MnemonViewState
  /** Active DSH locale id; it picks the language of a third-party descriptor. */
  language: string
  /** The configuration around these controls cannot be saved, such as a remote page without the management grant. */
  readOnly?: boolean
  t: MnemonTranslate
}

/**
 * The main Strategy choice (mutually exclusive) and the independent
 * enhancements, written through one View transaction. It states when memory
 * is not composed as chosen, and offers the switch that resolves it. Hidden
 * while the View dashboard cannot be read.
 */
export function MemoryCompositionSections({ store, state, language, readOnly = false, t }: MemoryCompositionProps): JSX.Element | null {
  // Per-instance ids keep each label, heading and radio group bound to its own controls.
  const instance = useId()
  const dashboard = state.dashboard
  if (state.status !== 'ready' || dashboard === null) return null
  const model = componentModel(dashboard)
  const { mains, enhancements, selected, composing } = model
  if (mains.length <= 1 && enhancements.length === 0 && composing !== undefined && composing === selected) return null
  const working = state.working
  const disabled = working !== null || !dashboard.writable || readOnly
  const copy = (entry: MemoryPluginEntryView) => componentCopy(entry, t, language)
  // The Host validates each write against the selected main Strategy, so
  // nothing else can change until that Strategy runs again.
  const selectedRunning = selected !== undefined && selected === composing
  const action = (key: string, label: string, run: () => void): ReactNode =>
    <button key={key} type="button" className={css.textButton} disabled={disabled} onClick={run}>{label}</button>
  const choose = (entry: MemoryPluginEntryView): void => { void chooseMain(store, model, entry) }
  const note = mainStrategyNote(model, t, copy, enhancements.length > 0, action, choose, entries => { void store.setEnabled('strategy:idle', entries.map(entry => ({ entry, enabled: false }))) })

  const toggle = (entry: MemoryPluginEntryView): void => {
    void store.setEnabled('enhancement:' + entry.entryId, [{ entry, enabled: !entry.enabled }])
  }
  const enhancementNote = (entry: MemoryPluginEntryView): ReactNode => {
    if (!entry.enabled) return undefined
    const unmet = unmetRequirements(dashboard, entry)[0]
    if (unmet !== undefined) {
      const provider = unmet.providers[0]
      if (provider === undefined) return t('config.componentNeedsMissing', { requirement: unmet.requirement })
      const name = copy(provider).label
      return <><span>{t('config.componentNeeds', { component: name })}</span>{selectedRunning && action('enable:' + provider.entryId, t('config.enableComponentNamed', { component: name }),
        () => { void store.setEnabled('enhancement:' + entry.entryId, [{ entry: provider, enabled: true }]) })}</>
    }
    if (!entry.active) return t('config.componentWaiting')
    if (composing !== undefined && !enhancementApplies(entry, composing)) return t('config.enhancementUnused', { strategy: copy(composing).label })
    return undefined
  }
  const failed = state.failure
  const failedHere = failed !== null && (failed.key.startsWith('strategy:') || failed.key.startsWith('enhancement:'))

  return <section className={`${css.section} ${css.enhancementsSection}`} aria-labelledby={`${instance}-strategy-heading`} aria-busy={working !== null}>
    <div className={css.sectionHeading}>
      <h2 id={`${instance}-strategy-heading`}>{t('config.strategySectionTitle')}</h2>
      <p>{t('config.strategySectionDescription')}</p>
      <span className={css.appliesNow}>{t('config.appliesNow')}</span>
    </div>
    {note}
    <div className={css.rows}>
      {mains.length > 1 && <SelectRow id={domId(`${instance}-strategy`, 'main')} label={t('config.strategyTitle')} value={dashboard.strategyTypeId}
        disabled={disabled || !mains.some(entry => entry.writable)}
        onChange={typeId => {
          const entry = mains.find(candidate => candidate.typeId === typeId)
          if (entry !== undefined && (entry !== selected || !entry.enabled || model.idle.length > 0)) choose(entry)
        }}
        options={mains.map(entry => {
          const text = copy(entry)
          return { value: entry.typeId!, label: text.label, detail: text.hint, ...(entry.writable ? {} : { disabled: true }) }
        })} />}
      {enhancements.map(entry => {
        const text = copy(entry)
        const rowNote = enhancementNote(entry)
        return <ToggleRow key={entry.entryId} id={domId(`${instance}-enhancement`, entry.entryId)} label={text.label} hint={text.hint}
          checked={entry.enabled} disabled={disabled || !entry.writable || !selectedRunning} onChange={() => toggle(entry)}
          {...(rowNote === undefined ? {} : { note: rowNote })} />
      })}
    </div>
    {failedHere && failed.kind === 'apply' && <p className={css.error} role="alert">{t(failed.key.startsWith('strategy:') ? 'config.strategyFailed' : 'config.enhancementsFailed')}</p>}
    {failedHere && failed.kind === 'refresh' && <p className={css.error} role="alert">{t('config.enhancementsRefreshFailed')}</p>}
  </section>
}

/** Why memory is not composed by the chosen main Strategy alone, and the switches that resolve it. */
function mainStrategyNote(
  model: MemoryComponentModel,
  t: MnemonTranslate,
  copy: (entry: MemoryPluginEntryView) => { label: string },
  hasEnhancements: boolean,
  action: (key: string, label: string, run: () => void) => ReactNode,
  choose: (entry: MemoryPluginEntryView) => void,
  stop: (entries: MemoryPluginEntryView[]) => void,
): ReactNode {
  const { selected, composing, idle, contenders } = model
  const selectedName = selected === undefined ? undefined : copy(selected).label
  const sentences = (...values: Array<string | false>): string => values.filter(value => value !== false && value !== '').join(t('config.sentenceGap'))
  const blocked = hasEnhancements && t('config.strategyEnhancementsBlocked')
  if (composing === undefined) {
    const reason = selected === undefined ? t('config.strategyNoneMissing')
      : !selected.enabled ? t('config.strategyNoneOff', { strategy: selectedName! })
        : t('config.strategyNoneWaiting', { strategy: selectedName! })
    const contention = contenders.length > 0 && t('config.strategyContenders', { strategies: nameList(contenders.map(entry => copy(entry).label), t) })
    return <StateNote tone="error" actions={selected !== undefined && !selected.enabled ? action('enable-selected', t('config.enableStrategy', { strategy: selectedName! }), () => choose(selected)) : undefined}>
      {sentences(reason, contention, t('config.memoryOffConversationsContinue'), blocked)}
    </StateNote>
  }
  if (composing !== selected) {
    const composingName = copy(composing).label
    return <StateNote tone="warn" actions={<>
      {selected !== undefined && !selected.enabled && action('enable-selected', t('config.enableStrategy', { strategy: selectedName! }), () => choose(selected))}
      {action('use-composing', t('config.useStrategy', { strategy: composingName }), () => choose(composing))}
    </>}>
      {sentences(selected === undefined ? t('config.strategyFallbackMissing', { composing: composingName }) : t('config.strategyFallback', { selected: selectedName!, composing: composingName }), blocked)}
    </StateNote>
  }
  if (idle.length > 0) {
    const names = nameList(idle.map(entry => copy(entry).label), t)
    return <StateNote tone="warn" actions={action('stop-idle', t('config.stopStrategies', { strategies: names }), () => stop(idle))}>
      {t('config.strategyIdle', { strategies: names })}
    </StateNote>
  }
  return undefined
}
