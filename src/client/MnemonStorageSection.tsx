import type { JSX } from 'react'
import { MNEMON_PACK_COMPONENTS, type ClientConnectionHandle, type ClientSettingsScope, type Config, type SettingsOperation } from '../host/protocol.ts'
import type { MemoryPluginEntryView, MemoryViewDashboard } from '../host/view-protocol.ts'
import { componentCopy } from './component-copy.ts'
import { ComponentChips } from './CompositionBoard.tsx'
import type { MnemonTranslate } from './locales.ts'
import css from './MnemonSettingsCard.module.css'
import { MnemonPackSection, type PackTarget } from './MnemonPackSection.tsx'
import { SelectRow, SettingRow } from './settings-controls.tsx'
import { PanelActions, useStaged } from './settings-panel.tsx'

type StorageChoice = 'global' | 'workspace' | 'workspaces'

interface StorageDraft {
  storageScope: string
  dataDir: string
}

function legacyPackDirectory(value: Config): string {
  const packs = value.customPacks ?? []
  return packs.find(pack => pack.id === value.customPackId)?.dataDir?.trim()
    ?? (packs.length === 1 ? packs[0]?.dataDir?.trim() : undefined)
    ?? ''
}

function storageDraft(value: Config | undefined): StorageDraft {
  const resolved = value ?? {}
  const dataDir = resolved.dataDir?.trim() || legacyPackDirectory(resolved)
  return { storageScope: resolved.storageScope ?? (dataDir === '' ? 'global' : 'custom'), dataDir }
}

function storageProblem(t: MnemonTranslate, draft: StorageDraft): string | null {
  if (!['global', 'workspace', 'custom', 'workspaces'].includes(draft.storageScope)) return t('config.invalidScope')
  if (draft.storageScope === 'custom' || (draft.storageScope === 'workspaces' && draft.dataDir.trim() !== '')) {
    const directory = draft.dataDir.trim()
    if (directory === '') return t('config.customRequired')
    const posixAbsolute = directory.startsWith('/')
    const homeRelative = directory === '~' || directory.startsWith('~/')
    const windowsDriveAbsolute = /^[a-zA-Z]:[\\/]/.test(directory)
    const windowsUncAbsolute = /^\\\\[^\\/]+[\\/][^\\/]+/.test(directory)
    if (directory.includes('\0') || (!posixAbsolute && !homeRelative && !windowsDriveAbsolute && !windowsUncAbsolute)) return t('config.customAbsolute')
  }
  return null
}

export interface MnemonStorageSectionProps {
  scope: ClientSettingsScope<Config>
  /** The saved configuration, and what the user file itself holds, for retiring legacy keys. */
  value: Config | undefined
  user: Record<string, unknown>
  disabled: boolean
  /** The components installed, to name the ones that keep their data here. */
  dashboard: MemoryViewDashboard | null
  /** The directory memory reads and writes now. */
  target: PackTarget | null
  connection?: ClientConnectionHandle
  sessionId?: string
  workspaceId?: string
  language: string
  t: MnemonTranslate
  onOpen: (entry: MemoryPluginEntryView) => void
  onSaved: () => void
}

/**
 * Where memory lives: the scope and directory, applied together because a
 * change moves where every component below reads and writes, and the ZIP
 * backup that carries the data from one place to another. The components
 * that keep their data here are named at the top, each opening its page.
 */
export function MnemonStorageSection(props: MnemonStorageSectionProps): JSX.Element {
  const { t } = props
  const saved = storageDraft(props.value)
  const storage = useStaged(saved, async draft => {
    const operations: SettingsOperation[] = []
    if (draft.storageScope !== saved.storageScope) operations.push({ op: 'set', path: ['storageScope'], value: draft.storageScope })
    if (draft.dataDir.trim() !== saved.dataDir.trim()) {
      operations.push(draft.dataDir.trim() === '' && draft.storageScope !== 'workspaces' ? { op: 'unset', path: ['dataDir'] } : { op: 'set', path: ['dataDir'], value: draft.dataDir.trim() })
    }
    if (operations.length === 0) return
    // A saved directory retires the named Packs an earlier version kept.
    if (Object.hasOwn(props.user, 'customPackId')) operations.push({ op: 'unset', path: ['customPackId'] })
    if (Object.hasOwn(props.user, 'customPacks')) operations.push({ op: 'unset', path: ['customPacks'] })
    await props.scope.mutate(operations)
    props.onSaved()
  })
  const { draft } = storage
  // A global scope with a directory is the stored `custom` scope; the directory field alone tells them apart.
  const choice: StorageChoice = draft.storageScope === 'workspace' || draft.storageScope === 'workspaces' ? draft.storageScope : 'global'
  const chooseScope = (next: StorageChoice): void => storage.edit({ storageScope: next === 'global' ? (draft.dataDir.trim() === '' ? 'global' : 'custom') : next })
  const editDirectory = (value: string): void => storage.edit(choice === 'global' ? { dataDir: value, storageScope: value.trim() === '' ? 'global' : 'custom' } : { dataDir: value })
  const problem = storageProblem(t, draft)
  // The Sources that keep their data here, in the order a backup lists them.
  const order = (entry: MemoryPluginEntryView): number => (MNEMON_PACK_COMPONENTS as readonly string[]).indexOf(entry.typeId ?? '')
  const users = (props.dashboard?.entries ?? []).filter(entry => entry.roles.includes('source') && order(entry) >= 0).sort((left, right) => order(left) - order(right))
  // Where memory lives now; while a change waits, the Apply line says what it does instead.
  const location = storage.dirty || props.target === null ? undefined
    : <span className={css.location}><span>{t('storage.current')}</span><code title={props.target.root}>{props.target.root}</code></span>
  return <section className={css.section} aria-labelledby="mnemon-storage-heading">
    <div className={css.sectionHeading}>
      <h2 id="mnemon-storage-heading">{t('config.storageTitle')}</h2>
      <ComponentChips label={t('storage.usedBy')} chips={users.map(entry => {
        const name = componentCopy(entry, props.language).label
        return { key: entry.entryId, name, on: entry.enabled, title: t('storage.usedByTitle', { component: name }), open: () => props.onOpen(entry) }
      })} />
    </div>
    <div className={css.rows}>
      <SelectRow id="mnemon-storage-scope" label={t('config.scopeTitle')} value={choice} disabled={props.disabled} onChange={chooseScope} options={[
        { value: 'global', label: t('config.global'), detail: t('config.globalScopeHint') },
        { value: 'workspace', label: t('config.workspace'), detail: t('config.workspaceScopeHint') },
        { value: 'workspaces', label: t('config.workspaces'), detail: t('config.workspacesHint') },
      ]} />
      {/* A workspace keeps its own directory, so there is nothing to type, only where it is. */}
      {choice === 'workspace'
        ? location === undefined ? null : <SettingRow title={t('config.dataDirectory')} hint={location} />
        : <SettingRow title={t('config.dataDirectory')} htmlFor="mnemon-data-directory" hint={location} stacked>
          <input id="mnemon-data-directory" className={css.directoryInput} type="text" value={draft.dataDir}
            aria-invalid={problem !== null}
            placeholder={t('config.nativeDefaultLocation')}
            disabled={props.disabled} autoComplete="off" spellCheck={false} autoCapitalize="none" autoCorrect="off"
            onChange={event => editDirectory(event.target.value)} />
        </SettingRow>}
      <PanelActions dirty={storage.dirty} saving={storage.saving} invalid={problem} failed={storage.failed} applied={storage.applied} disabled={props.disabled}
        note={t('storage.moveNote')} t={t} onDiscard={storage.discard} onApply={() => { void storage.apply() }} />
      <MnemonPackSection {...(props.connection === undefined ? {} : { connection: props.connection })} {...(props.sessionId === undefined ? {} : { sessionId: props.sessionId })}
        {...(props.workspaceId === undefined ? {} : { workspaceId: props.workspaceId })} target={props.target} t={t} />
    </div>
  </section>
}
