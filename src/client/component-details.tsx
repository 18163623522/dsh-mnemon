import type { JSX, ReactNode } from 'react'
import { Button, Modal, StateDot, Tag, TextShimmer, type StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MemoryJsonValue } from '../core/contracts/index.ts'
import type { MemoryPluginEntryView, MemoryViewDashboard } from '../host/view-protocol.ts'
import { isShipped, nameList } from './component-copy.ts'
import { relationsOf, switchPlan } from './component-model.ts'
import { ComponentOptions } from './component-options.tsx'
import type { MnemonTranslate } from './locales.ts'
import css from './MnemonSettingsCard.module.css'

/** A component's state as its row shows it. */
export interface ComponentState {
  tone?: StateDotState | undefined
  text: string
  pending?: boolean | undefined
}

export interface ComponentDetailsProps {
  entry: MemoryPluginEntryView
  dashboard: MemoryViewDashboard
  name: (entry: MemoryPluginEntryView) => string
  hint: string
  state: ComponentState | undefined
  /** The row's own control: its switch, or for a main Strategy the choice of it. */
  control: ReactNode
  /** Whether the options can be written now. */
  writable: boolean
  /** While this component's options cross the wire. */
  applying: boolean
  language: string
  t: MnemonTranslate
  onApply: (config: Record<string, MemoryJsonValue>) => void
  onClose: () => void
}

/**
 * Everything one component brings, in one place: what it is and where it
 * came from, how it relates to the other components installed and what its
 * switch would move, and the options it declares. Relations and options are
 * drawn from the component's own declarations, so an installed extension
 * gets the same page as a shipped component.
 */
export function ComponentDetails(props: ComponentDetailsProps): JSX.Element {
  const { entry, dashboard, name, t } = props
  const relations = relationsOf(dashboard, entry)
  const names = (entries: readonly MemoryPluginEntryView[]): string => nameList(entries.map(name), t)
  // What the switch would move beyond the component itself.
  const plan = entry.roles.includes('strategy') ? undefined : switchPlan(dashboard, entry, !entry.enabled)
  const others = plan?.changes?.filter(change => change.entry !== entry) ?? []
  const on = names(others.filter(change => change.enabled).map(change => change.entry))
  const off = names(others.filter(change => !change.enabled).map(change => change.entry))
  const effect = plan?.blocked === 'last-source' ? t('details.effectLast')
    : entry.enabled ? off === '' ? undefined : t('details.effectOff', { names: off })
      : on === '' && off === '' ? undefined : off === '' ? t('details.effectOn', { names: on }) : on === '' ? t('details.effectOnReplace', { names: off }) : t('details.effectOnMixed', { on, off })
  const needs = relations.needs.filter(need => need.providers.length > 0 || !need.met)
  const hasRelations = needs.length > 0 || relations.neededBy.length > 0 || relations.conflictsWith.length > 0 || effect !== undefined

  return <Modal open onClose={props.onClose} title={name(entry)} description={props.hint} closeLabel={t('common.close')} contentClassName={css.detailsBody ?? ''}>
    <div className={css.detailsHead}>
      <div className={css.detailsHeadLine}>
        {props.state !== undefined && <span className={css.boardState} data-tone={props.state.pending === true ? 'ongoing' : props.state.tone}>
          {props.state.pending === true
            ? <><StateDot state="ongoing" /><TextShimmer active>{props.state.text}</TextShimmer></>
            : <>{props.state.tone !== undefined && <StateDot state={props.state.tone} />}<span>{props.state.text}</span></>}
        </span>}
        <Tag tone={isShipped(entry) ? 'neutral' : 'info'}>{t(isShipped(entry) ? 'details.shipped' : 'details.installed')}</Tag>
        <span className={css.detailsControl}>{props.control}</span>
      </div>
      <code className={css.detailsPackage}>{entry.packageName}</code>
    </div>
    {hasRelations && <section className={css.detailsSection} aria-label={t('details.relations')}>
      <h3>{t('details.relations')}</h3>
      <dl className={css.detailsRelations}>
        {needs.map(need => <div key={need.requirement}>
          <dt>{t(need.providers.length > 1 ? 'details.needsAny' : 'details.needs')}</dt>
          <dd>{need.providers.length === 0
            ? <span className={css.detailsMissing}>{t('details.needsMissing', { capability: need.requirement })}</span>
            : need.providers.map(provider => <span key={provider.entryId} className={css.detailsName}><StateDot state={provider.enabled ? 'done' : 'idle'} />{name(provider)}</span>)}</dd>
        </div>)}
        {relations.neededBy.length > 0 && <div>
          <dt>{t('details.neededBy')}</dt>
          <dd>{relations.neededBy.map(dependent => <span key={dependent.entryId} className={css.detailsName}><StateDot state="done" />{name(dependent)}</span>)}</dd>
        </div>}
        {relations.conflictsWith.length > 0 && <div>
          <dt>{t('details.conflicts')}</dt>
          <dd>{relations.conflictsWith.map(other => <span key={other.entryId} className={css.detailsName}><StateDot state={other.enabled ? 'done' : 'idle'} />{name(other)}</span>)}</dd>
        </div>}
      </dl>
      {effect !== undefined && <p className={css.detailsEffect}>{effect}</p>}
    </section>}
    {entry.fields.length > 0 && <section className={css.detailsSection} aria-label={t('details.options')}>
      <h3>{t('details.options')}</h3>
      <ComponentOptions key={JSON.stringify(entry.config)} entry={entry} name={name(entry)} sources={dashboard.sources} language={props.language} t={t}
        disabled={!props.writable || !entry.writable} pending={props.applying} onApply={props.onApply} onCancel={props.onClose} />
    </section>}
  </Modal>
}

/** The choice of a main Strategy inside its page: the current one says so, another offers to switch. */
export function MainChoice(props: { selected: boolean; disabled: boolean; t: MnemonTranslate; onChoose: () => void }): JSX.Element {
  return props.selected
    ? <Tag tone="solid">{props.t('details.currentMain')}</Tag>
    : <Button variant="outline" size="sm" disabled={props.disabled} onClick={props.onChoose}>{props.t('details.useMain')}</Button>
}
