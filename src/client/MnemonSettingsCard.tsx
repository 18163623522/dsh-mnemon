import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type JSX, type ReactNode } from 'react'
import { IconChevronDownOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  DEFAULT_EMBEDDING_ENDPOINT,
  DEFAULT_IDLE_REVIEW,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_PROTOCOL,
  MNEMON_EMBEDDING_PROTOCOLS,
  normalizeDisplayMode,
  isWorkspaceStorageScope,
  type ClientConnectionHandle,
  type ClientSettingsScope,
  type ClientSettingsSnapshot,
  type Config,
  type InteractionConfig,
  type MemoryCompositionStatus,
  type MemoryTopologyDefinition,
  type MnemonEmbeddingStatus,
  type SettingsOperation,
  type TaskAgentModelCatalog,
  type ResolvedIdleReviewConfig,
} from "../host/protocol.ts"
import type { MemoryPluginEntryView, MemoryViewDashboard } from '../host/view-protocol.ts'
import { MnemonClient } from './api.ts'
import { MemoryCompositionSections } from './MemoryComposition.tsx'
import { SelectRow, SettingRow, ToggleRow } from './settings-controls.tsx'
import css from './MnemonSettingsCard.module.css'
import { isRecord } from './is-record.ts'
import { translateZh, type MnemonKey, type MnemonTranslate } from './locales.ts'
import { message } from './page-kit.tsx'
import { MnemonPackSection } from './MnemonPackSection.tsx'
import { ProviderIcon } from './ProviderIcon.tsx'
import { ProviderSettingsSection } from './ProviderSettingsSection.tsx'

export interface MnemonSettingsCardProps {
  scope: ClientSettingsScope<Config>
  /** Separate live namespace; without it the interaction toggles use `scope`. */
  interactionScope?: ClientSettingsScope<InteractionConfig>
  /** Loopback RPC used for whole-directory ZIP backup and restore. */
  connection?: ClientConnectionHandle
  sessionId?: string
  workspaceId?: string
  workspaceLabel?: string
  t?: MnemonTranslate
  /** Active DSH locale id for installed Strategies that bring their own text. */
  language?: string
}

type CoreField = 'displayMode' | 'storageScope' | 'runtimeUserScope' | 'dataDir'
type EmbeddingField = 'embeddingEnabled' | 'embeddingEndpoint' | 'embeddingModel' | 'embeddingApiKey' | 'embeddingProtocol'
type TaskAgentField = 'taskAgentModelMode' | 'taskAgentProvider' | 'taskAgentModel'
type InteractionField = 'turnBar' | 'saveAction'
type TopologyField = `memoryTopology.${string}`
type DraftField = CoreField | EmbeddingField | TaskAgentField | InteractionField | 'idleReview'
type Field = DraftField | TopologyField
interface Draft extends Record<InteractionField, boolean> {
  idleReview: ResolvedIdleReviewConfig
  displayMode: 'sidebar' | 'builtin'
  storageScope: string
  runtimeUserScope: 'storage' | 'global'
  dataDir: string
  embeddingEnabled: boolean
  embeddingEndpoint: string
  embeddingModel: string
  embeddingApiKey: string
  embeddingProtocol: string
  taskAgentModelMode: 'inherit' | 'fixed'
  taskAgentProvider: string
  taskAgentModel: string
}

const CORE_FIELDS: CoreField[] = ['displayMode', 'storageScope', 'runtimeUserScope', 'dataDir']
const EMBEDDING_FIELDS: EmbeddingField[] = ['embeddingEnabled', 'embeddingEndpoint', 'embeddingModel', 'embeddingApiKey', 'embeddingProtocol']
const INTERACTION_FIELDS: InteractionField[] = ['turnBar', 'saveAction']
const TASK_AGENT_FIELDS: TaskAgentField[] = ['taskAgentModelMode', 'taskAgentProvider', 'taskAgentModel']
function legacyPackDirectory(value: Config): string {
  const packs = value.customPacks ?? []
  return packs.find(pack => pack.id === value.customPackId)?.dataDir?.trim()
    ?? (packs.length === 1 ? packs[0]?.dataDir?.trim() : undefined)
    ?? ''
}

function coreDraft(value: Config | undefined): Pick<Draft, CoreField | EmbeddingField | TaskAgentField | 'idleReview'> {
  const resolved = value ?? {}
  const dataDir = resolved.dataDir?.trim() || legacyPackDirectory(resolved)
  return {
    idleReview: { ...DEFAULT_IDLE_REVIEW, ...resolved.idleReview },
    displayMode: normalizeDisplayMode(resolved.displayMode),
    storageScope: resolved.storageScope ?? (dataDir === '' ? 'global' : 'custom'),
    runtimeUserScope: resolved.runtimeUserScope === 'global' ? 'global' : 'storage',
    dataDir,
    embeddingEnabled: resolved.embedding?.enabled === true,
    embeddingEndpoint: resolved.embedding?.endpoint?.trim() || DEFAULT_EMBEDDING_ENDPOINT,
    embeddingModel: resolved.embedding?.model?.trim() || DEFAULT_EMBEDDING_MODEL,
    embeddingApiKey: resolved.embedding?.apiKey?.trim() ?? '',
    embeddingProtocol: resolved.embedding?.protocol ?? DEFAULT_EMBEDDING_PROTOCOL,
    taskAgentModelMode: resolved.taskAgentModel?.mode === 'fixed' ? 'fixed' : 'inherit',
    taskAgentProvider: resolved.taskAgentModel?.provider?.trim() ?? '',
    taskAgentModel: resolved.taskAgentModel?.model?.trim() ?? '',
  }
}

function validEmbeddingEndpoint(value: string): boolean {
  const endpoint = value.trim()
  if (endpoint === '' || endpoint.length > 2048) return false
  try {
    const parsed = new URL(endpoint)
    return ['http:', 'https:'].includes(parsed.protocol)
      && parsed.username === '' && parsed.password === ''
      && !endpoint.includes('?') && !endpoint.includes('#')
  } catch {
    return false
  }
}

function validEmbeddingModel(value: string): boolean {
  const model = value.trim()
  return model.length > 0 && model.length <= 200 && !/[\u0000-\u001f\u007f]/u.test(model)
}

function validEmbeddingApiKey(value: string): boolean {
  const key = value.trim()
  return key.length <= 2048 && !/[\u0000-\u001f\u007f]/u.test(key)
}

function interactionDraft(value: InteractionConfig | undefined): Pick<Draft, InteractionField> {
  return {
    turnBar: value?.turnBar !== false,
    saveAction: value?.saveAction !== false,
  }
}

function draftOf(core: Config | undefined, interaction: InteractionConfig | undefined): Draft {
  return { ...coreDraft(core), ...interactionDraft(interaction) }
}

function topologyOf(descriptor: MemoryCompositionStatus): MemoryTopologyDefinition {
  return {
    id: descriptor.configuration.id,
    strategyId: descriptor.configuration.strategyId,
    layers: Object.entries(descriptor.configuration.layers).map(([id, layer]) => ({
      id,
      enabled: layer.enabled,
      participation: { ...layer.participation },
      adapterIds: [...layer.adapterIds],
    })),
  }
}

function validation(t: MnemonTranslate, draft: Draft): string | null {
  for (const [field, min, max] of [['minIntervalMs', 5_000, 86_400_000], ['maxPerSession', 0, 200], ['maxContextChars', 1_000, 1_000_000], ['maxTokens', 128, 131_072]] as const) {
    const value = draft.idleReview[field]
    if (!Number.isInteger(value) || value < min || value > max) return t('config.reviewInvalid')
  }
  if (!['global', 'workspace', 'custom', 'workspaces'].includes(draft.storageScope)) return t('config.invalidScope')
  if (!['storage', 'global'].includes(draft.runtimeUserScope)) return t('config.invalidRuntimeUserScope')
  if (draft.storageScope === 'custom' || (draft.storageScope === 'workspaces' && draft.dataDir.trim() !== '')) {
    const directory = draft.dataDir.trim()
    if (directory === '') return t('config.customRequired')
    const posixAbsolute = directory.startsWith('/')
    const homeRelative = directory === '~' || directory.startsWith('~/')
    const windowsDriveAbsolute = /^[a-zA-Z]:[\\/]/.test(directory)
    const windowsUncAbsolute = /^\\\\[^\\/]+[\\/][^\\/]+/.test(directory)
    if (directory.includes('\0') || (!posixAbsolute && !homeRelative && !windowsDriveAbsolute && !windowsUncAbsolute)) return t('config.customAbsolute')
  }
  if (draft.embeddingEnabled && !validEmbeddingEndpoint(draft.embeddingEndpoint)) return t('config.embeddingEndpointInvalid')
  if (draft.embeddingEnabled && !validEmbeddingModel(draft.embeddingModel)) return t('config.embeddingModelInvalid')
  if (draft.embeddingEnabled && !validEmbeddingApiKey(draft.embeddingApiKey)) return t('config.embeddingApiKeyInvalid')
  if (draft.embeddingEnabled && !MNEMON_EMBEDDING_PROTOCOLS.includes(draft.embeddingProtocol as typeof MNEMON_EMBEDDING_PROTOCOLS[number])) return t('config.embeddingProtocolInvalid')
  if (draft.taskAgentModelMode === 'fixed' && (draft.taskAgentProvider.trim() === '' || draft.taskAgentModel.trim() === '')) return t('config.taskAgentRouteRequired')
  return null
}

function useScope<T>(scope: ClientSettingsScope<T>): ClientSettingsSnapshot<T> {
  const subscribe = useMemo(() => scope.subscribe.bind(scope), [scope])
  const getSnapshot = useMemo(() => scope.getSnapshot.bind(scope), [scope])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

function operations(fields: readonly DraftField[], dirty: ReadonlySet<Field>, draft: Draft): SettingsOperation[] {
  return fields.flatMap((field): SettingsOperation[] => {
    if (!dirty.has(field)) return []
    if (field === 'dataDir' && draft.dataDir.trim() === '' && draft.storageScope !== 'workspaces') return [{ op: 'unset', path: [field] }]
    const value = draft[field]
    return [{ op: 'set', path: [field], value: typeof value === 'string' ? value.trim() : value }]
  })
}

/** The dsh-mnemon configuration, shown on its bundle page under DSH Plugins. */
export function MnemonSettingsCard({ scope, interactionScope: suppliedInteractionScope, connection, sessionId, workspaceId, workspaceLabel, t = translateZh, language = 'zh' }: MnemonSettingsCardProps): JSX.Element | null {
  const interactionScope = suppliedInteractionScope ?? scope as unknown as ClientSettingsScope<InteractionConfig>
  const coreSnapshot = useScope(scope)
  const interactionSnapshot = useScope(interactionScope)
  const [draft, setDraft] = useState<Draft>(() => draftOf(coreSnapshot.value, interactionSnapshot.value))
  const [dirty, setDirty] = useState<Set<Field>>(() => new Set())
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)
  const [targetRevision, setTargetRevision] = useState(0)
  const [modelCatalog, setModelCatalog] = useState<TaskAgentModelCatalog | null>(null)
  const [modelCatalogState, setModelCatalogState] = useState<'unavailable' | 'loading' | 'ready' | 'error'>(connection === undefined ? 'unavailable' : 'loading')
  const [modelCatalogError, setModelCatalogError] = useState<string | null>(null)
  const [fullModelCatalogLoaded, setFullModelCatalogLoaded] = useState(false)
  const modelCatalogRequest = useRef(0)
  const [memorySystem, setMemorySystem] = useState<MemoryCompositionStatus | null>(null)
  const [topologyDraft, setTopologyDraft] = useState<MemoryTopologyDefinition | null>(null)
  const [topologyState, setTopologyState] = useState<'unavailable' | 'loading' | 'ready' | 'error'>(connection === undefined ? 'unavailable' : 'loading')
  const topologyRequest = useRef(0)
  const [embeddingStatus, setEmbeddingStatus] = useState<MnemonEmbeddingStatus | null>(null)
  // Mnemon Native is one Provider among peers; unknown until the Host reports whether its CLI is installed.
  const [nativeCliFound, setNativeCliFound] = useState<boolean | undefined>(undefined)
  const [embeddingStatusState, setEmbeddingStatusState] = useState<'unavailable' | 'idle' | 'loading' | 'ready' | 'error'>(connection === undefined ? 'unavailable' : 'idle')
  const [embeddingStatusError, setEmbeddingStatusError] = useState<string | null>(null)
  const embeddingStatusRequest = useRef(0)
  const configuredTaskAgentMode = coreSnapshot.value?.taskAgentModel?.mode === 'fixed' ? 'fixed' : 'inherit'

  useEffect(() => {
    if (dirty.size === 0) setDraft(draftOf(coreSnapshot.value, interactionSnapshot.value))
  }, [dirty.size, coreSnapshot.value, interactionSnapshot.value])

  const loadModelCatalog = useCallback((includeCatalog: boolean): void => {
    if (connection === undefined) {
      modelCatalogRequest.current += 1
      setModelCatalog(null)
      setModelCatalogState('unavailable')
      setModelCatalogError(null)
      setFullModelCatalogLoaded(false)
      return
    }
    const request = modelCatalogRequest.current + 1
    modelCatalogRequest.current = request
    setModelCatalogState('loading')
    setModelCatalogError(null)
    void new MnemonClient(connection).taskAgentModels(includeCatalog).then(catalog => {
      if (modelCatalogRequest.current !== request) return
      setModelCatalog(catalog)
      setModelCatalogState('ready')
      setFullModelCatalogLoaded(includeCatalog)
      if (includeCatalog) {
        setDraft(current => {
          if (current.taskAgentModelMode !== 'fixed') return current
          const provider = current.taskAgentProvider
            || catalog.defaultSelection?.provider
            || catalog.groups[0]?.id
            || ''
          const group = catalog.groups.find(candidate => candidate.id === provider)
          const model = current.taskAgentModel
            || (catalog.defaultSelection?.provider === provider ? catalog.defaultSelection.model : undefined)
            || group?.models[0]?.id
            || ''
          return provider === current.taskAgentProvider && model === current.taskAgentModel
            ? current
            : { ...current, taskAgentProvider: provider, taskAgentModel: model }
        })
      }
    }, reason => {
      if (modelCatalogRequest.current !== request) return
      setModelCatalogState('error')
      setModelCatalogError(message(reason))
    })
  }, [connection])

  useEffect(() => {
    loadModelCatalog(configuredTaskAgentMode === 'fixed')
    return () => { modelCatalogRequest.current += 1 }
  }, [configuredTaskAgentMode, loadModelCatalog])

  useEffect(() => {
    if (connection === undefined) {
      topologyRequest.current += 1
      setMemorySystem(null)
      setTopologyDraft(null)
      setTopologyState('unavailable')
      return
    }
    const request = topologyRequest.current + 1
    topologyRequest.current = request
    setTopologyState('loading')
    void new MnemonClient(connection, sessionId, workspaceId).memorySystem().then(descriptor => {
      if (topologyRequest.current !== request) return
      setMemorySystem(descriptor)
      setTopologyDraft(topologyOf(descriptor))
      setTopologyState('ready')
    }, () => {
      if (topologyRequest.current !== request) return
      setMemorySystem(null)
      setTopologyDraft(null)
      setTopologyState('error')
    })
    return () => { topologyRequest.current += 1 }
  }, [connection, sessionId, workspaceId, targetRevision])

  useEffect(() => {
    embeddingStatusRequest.current += 1
    setEmbeddingStatus(null)
    setEmbeddingStatusError(null)
    setEmbeddingStatusState(connection === undefined ? 'unavailable' : 'idle')
    return () => { embeddingStatusRequest.current += 1 }
  }, [connection, sessionId, workspaceId, targetRevision])

  useEffect(() => {
    if (connection === undefined) { setNativeCliFound(undefined); return }
    let current = true
    void new MnemonClient(connection, sessionId, workspaceId).statusSummary().then(
      summary => { if (current) setNativeCliFound(summary.commandFound) },
      () => { if (current) setNativeCliFound(undefined) },
    )
    return () => { current = false }
  }, [connection, sessionId, workspaceId, targetRevision])

  const testEmbedding = (): void => {
    if (connection === undefined) return
    const request = embeddingStatusRequest.current + 1
    embeddingStatusRequest.current = request
    setEmbeddingStatus(null)
    setEmbeddingStatusError(null)
    setEmbeddingStatusState('loading')
    void new MnemonClient(connection, sessionId, workspaceId).embeddingStatus().then(status => {
      if (embeddingStatusRequest.current !== request) return
      setEmbeddingStatus(status)
      setEmbeddingStatusState('ready')
    }, reason => {
      if (embeddingStatusRequest.current !== request) return
      setEmbeddingStatusError(message(reason))
      setEmbeddingStatusState('error')
    })
  }

  const coreUser = useMemo(() => isRecord(coreSnapshot.user) ? coreSnapshot.user : {}, [coreSnapshot.user])
  const activeScope = isWorkspaceStorageScope(coreDraft(coreSnapshot.value).storageScope) ? 'workspace' : 'global'
  const error = validation(t, draft)
  const loading = coreSnapshot.status === 'loading' || interactionSnapshot.status === 'loading'
  // A successful writable settings snapshot is the Host's authoritative
  // capability grant. DSH authenticates the complete Host API, so transport
  // locality is not a capability signal.
  const writable = coreSnapshot.writable && interactionSnapshot.writable

  if (coreSnapshot.status === 'unavailable' && interactionSnapshot.status === 'unavailable') {
    return <section className={css.page} aria-label={t('config.aria')}><p className={css.error} role="alert">{t('config.unavailable')}</p></section>
  }

  const edit = (field: Field, value: string | boolean): void => {
    setDraft(current => ({ ...current, [field]: value }))
    setDirty(current => new Set(current).add(field))
    setFailed(null)
    setApplied(false)
  }

  const editMany = (values: Partial<Draft>): void => {
    setDraft(current => ({ ...current, ...values }))
    setDirty(current => new Set([...current, ...Object.keys(values) as Field[]]))
    setFailed(null)
    setApplied(false)
  }

  const discard = (): void => {
    setDraft(draftOf(coreSnapshot.value, interactionSnapshot.value))
    setTopologyDraft(memorySystem === null ? null : topologyOf(memorySystem))
    setDirty(new Set()); setFailed(null); setApplied(false)
  }

  const save = async (): Promise<void> => {
    if (error !== null || dirty.size === 0 || saving || !writable) return
    setSaving(true); setFailed(null)
    try {
      const coreOps = operations(CORE_FIELDS, dirty, draft)
      const regularCoreChanged = coreOps.length > 0
      coreOps.push(...operations(['idleReview'], dirty, draft))
      const embeddingChanged = EMBEDDING_FIELDS.some(field => dirty.has(field))
      const taskAgentChanged = TASK_AGENT_FIELDS.some(field => dirty.has(field))
      const topologyChanged = [...dirty].some(field => field.startsWith('memoryTopology.'))
      if (regularCoreChanged) {
        if (Object.hasOwn(coreUser, 'customPackId')) coreOps.push({ op: 'unset', path: ['customPackId'] })
        if (Object.hasOwn(coreUser, 'customPacks')) coreOps.push({ op: 'unset', path: ['customPacks'] })
      }
      if (taskAgentChanged) {
        coreOps.push({
          op: 'set',
          path: ['taskAgentModel'],
          value: draft.taskAgentModelMode === 'inherit'
            ? { mode: 'inherit' }
            : { mode: 'fixed', provider: draft.taskAgentProvider.trim(), model: draft.taskAgentModel.trim() },
        })
      }
      if (embeddingChanged) {
        const validEndpoint = validEmbeddingEndpoint(draft.embeddingEndpoint)
        const validModel = validEmbeddingModel(draft.embeddingModel)
        const validApiKey = validEmbeddingApiKey(draft.embeddingApiKey)
        const validProtocol = MNEMON_EMBEDDING_PROTOCOLS.includes(draft.embeddingProtocol as typeof MNEMON_EMBEDDING_PROTOCOLS[number])
        coreOps.push({
          op: 'set',
          path: ['embedding'],
          value: draft.embeddingEnabled
            ? {
                enabled: true,
                endpoint: draft.embeddingEndpoint.trim().replace(/\/+$/u, ''),
                model: draft.embeddingModel.trim(),
                protocol: draft.embeddingProtocol,
                apiKey: draft.embeddingApiKey.trim(),
              }
            : {
                enabled: false,
                ...(validEndpoint ? { endpoint: draft.embeddingEndpoint.trim().replace(/\/+$/u, '') } : {}),
                ...(validModel ? { model: draft.embeddingModel.trim() } : {}),
                ...(validProtocol ? { protocol: draft.embeddingProtocol } : {}),
                ...(validApiKey ? { apiKey: draft.embeddingApiKey.trim() } : {}),
              },
        })
      }
      if (topologyChanged && topologyDraft !== null) {
        for (const layer of topologyDraft.layers) {
          if (!dirty.has(`memoryTopology.${layer.id}.enabled`)) continue
          coreOps.push({ op: 'set', path: ['memoryTopology', 'layers', layer.id, 'enabled'], value: layer.enabled })
        }
      }
      const interactionOps = operations(INTERACTION_FIELDS, dirty, draft)
      await Promise.all([
        ...(coreOps.length === 0 ? [] : [scope.mutate(coreOps)]),
        ...(interactionOps.length === 0 ? [] : [interactionScope.mutate(interactionOps)]),
      ])
      setDirty(new Set())
      setApplied(true)
      if (regularCoreChanged || embeddingChanged || topologyChanged) setTargetRevision(revision => revision + 1)
    } catch (reason) {
      setFailed(message(reason))
    } finally {
      setSaving(false)
    }
  }

  const coreDisabled = loading || saving || !coreSnapshot.writable
  const interactionDisabled = loading || saving || !interactionSnapshot.writable
  const scopeChanging = dirty.has('storageScope') || dirty.has('runtimeUserScope') || dirty.has('dataDir')
  const embeddingChanging = EMBEDDING_FIELDS.some(field => dirty.has(field))
  const editLayerEnabled = (layerId: string, enabled: boolean): void => {
    setTopologyDraft(current => current === null ? current : {
      ...current,
      layers: current.layers.map(layer => layer.id === layerId ? { ...layer, enabled } : layer),
    })
    setDirty(current => new Set(current).add(`memoryTopology.${layerId}.enabled`))
    setFailed(null)
    setApplied(false)
  }
  // A global scope with a directory is the stored `custom` scope; the directory field alone tells them apart.
  const scopeChoice: StorageChoice = draft.storageScope === 'custom' ? 'global' : draft.storageScope === 'workspace' || draft.storageScope === 'workspaces' ? draft.storageScope : 'global'
  const chooseScope = (choice: StorageChoice): void => {
    edit('storageScope', choice === 'global' ? (draft.dataDir.trim() === '' ? 'global' : 'custom') : choice)
  }
  const editDirectory = (value: string): void => {
    const globalScope = value.trim() === '' ? 'global' : 'custom'
    if (scopeChoice === 'global' && globalScope !== draft.storageScope) editMany({ dataDir: value, storageScope: globalScope })
    else edit('dataDir', value)
  }
  // The DSH Plugins page draws the plugin's title and description above this
  // section. Composition comes first, then where memory lives, then how the
  // background tasks and the in-conversation surfaces behave.
  return (
    <section className={css.page} aria-label={t('config.aria')} aria-busy={saving || loading}>
      {loading ? <p className={css.loading} role="status">{t('common.loading')}</p> : <>
        <MemoryCompositionSections
          {...(connection === undefined ? {} : { connection })}
          {...(sessionId === undefined ? {} : { sessionId })}
          {...(workspaceId === undefined ? {} : { workspaceId })}
          refreshKey={targetRevision}
          language={language}
          t={t}
        />

        <MemoryTopologySection
          descriptor={memorySystem}
          topology={topologyDraft}
          state={topologyState}
          disabled={coreDisabled}
          onEnabled={editLayerEnabled}
          t={t}
        />

        <section className={css.section} aria-labelledby="mnemon-providers-heading">
          <div className={css.sectionHeading}><h2 id="mnemon-providers-heading">{t('config.providersTitle')}</h2><p>{t('config.providersDescription')}</p></div>
          <ProviderSettingsSection
            {...(connection === undefined ? {} : { connection })}
            {...(sessionId === undefined ? {} : { sessionId })}
            {...(workspaceId === undefined ? {} : { workspaceId })}
            {...(activeScope !== 'workspace' || workspaceLabel === undefined ? {} : { workspaceLabel })}
            activeScope={activeScope}
            refreshKey={targetRevision}
            disabled={coreDisabled}
            scopeChanging={scopeChanging}
            t={t}
            leading={<NativeProviderCard activeScope={activeScope} cliMissing={nativeCliFound === false} t={t}>
              <EmbeddingSettingsSection
                draft={draft}
                disabled={coreDisabled}
                connectionAvailable={connection !== undefined}
                cliMissing={nativeCliFound === false}
                changing={embeddingChanging}
                status={embeddingStatus}
                state={embeddingStatusState}
                error={embeddingStatusError}
                onEdit={edit}
                onTest={testEmbedding}
                t={t}
              />
            </NativeProviderCard>}
          />
        </section>

        <section className={css.section} aria-labelledby="mnemon-storage-heading">
          <div className={css.sectionHeading}><h2 id="mnemon-storage-heading">{t('config.storageTitle')}</h2><p>{t('config.storageDescription')}</p></div>
          <div className={css.rows}>
            <SelectRow id="mnemon-storage-scope" label={t('config.scopeTitle')} value={scopeChoice} disabled={coreDisabled} onChange={chooseScope} options={[
              { value: 'global', label: t('config.global'), detail: t('config.globalScopeHint') },
              { value: 'workspace', label: t('config.workspace'), detail: t('config.workspaceScopeHint') },
              { value: 'workspaces', label: t('config.workspaces'), detail: t('config.workspacesHint') },
            ]} />
            {scopeChoice !== 'workspace' && <SettingRow title={t('config.dataDirectory')} htmlFor="mnemon-data-directory" hint={scopeChoice === 'workspaces' ? t('config.dataDirectoryWorkspacesHint') : t('config.dataDirectoryHint')} stacked>
              <input id="mnemon-data-directory" className={css.directoryInput} type="text" value={draft.dataDir}
                aria-invalid={error !== null && (draft.storageScope === 'custom' || draft.storageScope === 'workspaces')}
                placeholder={scopeChoice === 'workspaces' ? t('config.workspacesDefault') : t('config.nativeDefaultLocation')}
                disabled={coreDisabled} autoComplete="off" spellCheck={false} autoCapitalize="none" autoCorrect="off"
                onChange={event => editDirectory(event.target.value)} />
            </SettingRow>}
            <SelectRow id="mnemon-runtime-user-scope" label={t('config.runtimeUserScopeTitle')} value={draft.runtimeUserScope} disabled={coreDisabled} onChange={value => edit('runtimeUserScope', value)} options={[
              { value: 'storage', label: t('config.runtimeUserScopeStorage'), detail: t('config.runtimeUserScopeStorageHint') },
              { value: 'global', label: t('config.runtimeUserScopeGlobal'), detail: t('config.runtimeUserScopeGlobalHint') },
            ]} />
            <MnemonPackSection {...(connection === undefined ? {} : { connection })} {...(sessionId === undefined ? {} : { sessionId })} {...(workspaceId === undefined ? {} : { workspaceId })} refreshKey={targetRevision} t={t} />
          </div>
        </section>

        <section className={css.section} aria-labelledby="mnemon-background-heading">
          <div className={css.sectionHeading}>
            <h2 id="mnemon-background-heading">{t('config.backgroundTitle')}</h2>
            <p>{t('config.backgroundDescription')}</p>
            {modelCatalogState === 'loading' && <span className={css.miniSpinner} aria-hidden="true" />}
          </div>
          <div className={css.rows}>
            <TaskAgentModelRows
              draft={draft}
              catalog={modelCatalog}
              state={modelCatalogState}
              error={modelCatalogError}
              disabled={coreDisabled}
              fullCatalogLoaded={fullModelCatalogLoaded}
              onLoadCatalog={() => loadModelCatalog(true)}
              onEdit={edit}
              onEditMany={editMany}
              t={t}
            />
            <IdleReviewRows draft={draft} disabled={coreDisabled} onEditMany={editMany} t={t} />
          </div>
        </section>

        <section className={css.section} aria-labelledby="mnemon-interface-heading">
          <div className={css.sectionHeading}><h2 id="mnemon-interface-heading">{t('config.interfaceTitle')}</h2></div>
          <div className={css.rows}>
            <SelectRow id="mnemon-display" label={t('config.displayTitle')} value={draft.displayMode} disabled={coreDisabled} onChange={value => edit('displayMode', value)} options={[
              { value: 'sidebar', label: t('config.displaySidebar'), detail: t('config.displaySidebarHint') },
              { value: 'builtin', label: t('config.displayBuiltin'), detail: t('config.displayBuiltinHint') },
            ]} />
            <ToggleRow id="mnemon-interaction-turn-bar" label={t('config.interactionTurnBar')} hint={t('config.interactionTurnBarHint')} checked={draft.turnBar} disabled={interactionDisabled} onChange={value => edit('turnBar', value)} />
            <ToggleRow id="mnemon-interaction-save-action" label={t('config.interactionSaveAction')} hint={t('config.interactionSaveActionHint')} checked={draft.saveAction} disabled={interactionDisabled} onChange={value => edit('saveAction', value)} />
          </div>
        </section>

        <div className={css.feedback} aria-live="polite">
          {error !== null && <p className={css.error} role="alert">{error}</p>}
          {failed !== null && <p className={css.error} role="alert">{t('config.saveFailed', { error: failed })}</p>}
          {applied && <p className={css.success} role="status">{t('config.ready')}</p>}
          {!writable && <p className={css.readOnly}>{t('config.readOnly')}</p>}
        </div>

        <footer className={`${css.actions} ${dirty.size > 0 ? css.actionsVisible : ''}`} aria-live="polite">
          <span>{t('config.unsaved')}</span>
          <div><button type="button" className={css.discard} disabled={saving} onClick={discard}>{t('config.discard')}</button><button type="button" className={css.save} disabled={saving || error !== null || !writable} onClick={() => void save()}>{saving ? t('config.saving') : t('config.save')}</button></div>
        </footer>
      </>}
    </section>
  )
}

type StorageChoice = 'global' | 'workspace' | 'workspaces'

/** Mnemon Native, listed first among the Providers; its body holds the settings only Native reads. */
function NativeProviderCard(props: { activeScope: 'global' | 'workspace'; cliMissing: boolean; t: MnemonTranslate; children: ReactNode }): JSX.Element {
  return <details className={css.providerRow} data-provider="mnemon-native" data-native="">
    <summary className={css.providerRowHeader}>
      <span className={css.providerIdentity}><ProviderIcon providerId="mnemon-native" icon={{ kind: 'brand', value: 'mnemon' }} className={css.providerMark} /><span><strong>{props.t('config.nativeName')}</strong><small>{props.t('config.nativeSummary')}</small></span></span>
      <span className={css.providerEnableControl}>
        <span className={css.providerScopeTag} data-scope={props.activeScope}>{props.t(`config.${props.activeScope}`)}</span>
        <span className={css.providerState} data-enabled={props.cliMissing ? undefined : ''}>{props.t(props.cliMissing ? 'config.nativeCliMissing' : 'config.officialNative')}</span>
        <IconChevronDownOutlineRegular className={css.providerChevron} size={14} />
      </span>
    </summary>
    <div className={css.providerInlineBody}>{props.children}</div>
  </details>
}

/** Reachability and coverage line; the protocol appears only when the Host reports one. */
function embeddingStatusText(t: MnemonTranslate, status: MnemonEmbeddingStatus): string {
  const coverage = { embedded: status.embedded, total: status.totalInsights, coverage: status.coverage }
  return status.protocol === undefined
    ? t(status.available ? 'config.embeddingStatusAvailable' : 'config.embeddingStatusUnavailable', { model: status.model, ...coverage })
    : t(status.available ? 'config.embeddingStatusAvailableWithProtocol' : 'config.embeddingStatusUnavailableWithProtocol', { model: status.model, protocol: status.protocol, ...coverage })
}

function EmbeddingSettingsSection(props: {
  draft: Draft
  disabled: boolean
  connectionAvailable: boolean
  /** The test runs the Mnemon CLI, which only Mnemon Native needs. */
  cliMissing: boolean
  changing: boolean
  status: MnemonEmbeddingStatus | null
  state: 'unavailable' | 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  onEdit: (field: Field, value: string | boolean) => void
  onTest: () => void
  t: MnemonTranslate
}): JSX.Element {
  const feedback = props.cliMissing
    ? props.t('config.embeddingCliMissing')
    : props.changing
    ? props.t('config.embeddingSaveBeforeTest')
    : props.state === 'loading'
      ? props.t('config.embeddingTesting')
      : props.state === 'error'
        ? props.t('config.embeddingStatusFailed', { error: props.error ?? '' })
        : props.state === 'ready' && props.status !== null
          ? embeddingStatusText(props.t, props.status)
          : props.state === 'unavailable'
            ? props.t('config.embeddingTestUnavailable')
            : props.t('config.embeddingNotTested')
  return <section className={css.editor} aria-labelledby="mnemon-embedding-heading">
    <div className={css.editorHeading}>
      <h3 id="mnemon-embedding-heading">{props.t('config.embeddingTitle')}</h3>
      <p>{props.t('config.embeddingDescription')}</p>
    </div>
    <ToggleRow
      id="mnemon-embedding-managed"
      label={props.t('config.embeddingManaged')}
      hint={props.t('config.embeddingManagedHint')}
      checked={props.draft.embeddingEnabled}
      disabled={props.disabled}
      onChange={value => props.onEdit('embeddingEnabled', value)}
    />
    <div className={css.fieldGrid}>
      <label>
        {props.t('config.embeddingEndpoint')}
        <input
          type="url"
          aria-label={props.t('config.embeddingEndpoint')}
          aria-invalid={props.draft.embeddingEnabled && !validEmbeddingEndpoint(props.draft.embeddingEndpoint)}
          value={props.draft.embeddingEndpoint}
          disabled={props.disabled || !props.draft.embeddingEnabled}
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          placeholder={DEFAULT_EMBEDDING_ENDPOINT}
          onChange={event => props.onEdit('embeddingEndpoint', event.target.value)}
        />
      </label>
      <label>
        {props.t('config.embeddingModel')}
        <input
          type="text"
          aria-label={props.t('config.embeddingModel')}
          aria-invalid={props.draft.embeddingEnabled && !validEmbeddingModel(props.draft.embeddingModel)}
          value={props.draft.embeddingModel}
          disabled={props.disabled || !props.draft.embeddingEnabled}
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          placeholder={DEFAULT_EMBEDDING_MODEL}
          onChange={event => props.onEdit('embeddingModel', event.target.value)}
        />
      </label>
      <label>
        {props.t('config.embeddingProtocol')}
        <select
          aria-label={props.t('config.embeddingProtocol')}
          value={props.draft.embeddingProtocol}
          disabled={props.disabled || !props.draft.embeddingEnabled}
          onChange={event => props.onEdit('embeddingProtocol', event.target.value)}
        >
          <option value="auto">{props.t('config.embeddingProtocolAuto')}</option>
          <option value="ollama">{props.t('config.embeddingProtocolOllama')}</option>
          <option value="openai">{props.t('config.embeddingProtocolOpenai')}</option>
        </select>
      </label>
      <label>
        {props.t('config.embeddingApiKey')}
        <input
          type="password"
          aria-label={props.t('config.embeddingApiKey')}
          aria-invalid={props.draft.embeddingEnabled && !validEmbeddingApiKey(props.draft.embeddingApiKey)}
          value={props.draft.embeddingApiKey}
          disabled={props.disabled || !props.draft.embeddingEnabled}
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="sk-…"
          onChange={event => props.onEdit('embeddingApiKey', event.target.value)}
        />
      </label>
    </div>
    <p className={css.editorNote}>{props.t('config.embeddingSecurity')}</p>
    <div className={css.embeddingTest} aria-live="polite">
      <span className={props.state === 'error' ? css.error : undefined} role={props.state === 'error' ? 'alert' : undefined}>{feedback}</span>
      <button
        type="button"
        className={css.pillButton}
        disabled={props.disabled || !props.connectionAvailable || props.cliMissing || props.changing || props.state === 'loading'}
        onClick={props.onTest}
      >{props.t('config.embeddingTest')}</button>
    </div>
  </section>
}

function MemoryTopologySection(props: {
  descriptor: MemoryCompositionStatus | null
  topology: MemoryTopologyDefinition | null
  state: 'unavailable' | 'loading' | 'ready' | 'error'
  disabled: boolean
  onEnabled: (layerId: string, enabled: boolean) => void
  t: MnemonTranslate
}): JSX.Element {
  const layerDescriptors = new Map(props.descriptor?.sources.map(source => [source.sourceTypeId, source.management]) ?? [])

  const builtInCopy = (layerId: string): { label: string; description: string } | undefined => {
    if (layerId === 'runtime') return { label: props.t('layers.runtimeLabel'), description: props.t('layers.runtimeDescription') }
    if (layerId === 'documents') return { label: props.t('layers.documentsLabel'), description: props.t('layers.documentsDescription') }
    if (layerId === 'memory-spaces') return { label: props.t('layers.memorySpacesLabel'), description: props.t('layers.memorySpacesDescription') }
    return undefined
  }

  return <section className={css.section} aria-labelledby="mnemon-topology-heading">
    <div className={css.sectionHeading}>
      <h2 id="mnemon-topology-heading">{props.t('config.topologyTitle')}</h2>
      <p>{props.t('config.topologyDescription')}</p>
      {props.state === 'loading' && <span className={css.miniSpinner} aria-hidden="true" />}
    </div>
    {props.topology === null
      ? <p className={css.topologyUnavailable}>{props.state === 'loading' ? props.t('config.topologyLoading') : props.t('config.topologyUnavailable')}</p>
      : <div className={css.rows}>
        {props.topology.layers.map(layer => {
          const descriptor = layerDescriptors.get(layer.id)
          const copy = builtInCopy(layer.id)
          const label = copy?.label ?? descriptor?.label ?? layer.id
          const description = copy?.description ?? descriptor?.description ?? layer.id
          return <ToggleRow key={layer.id} id={`mnemon-layer-${layer.id}`} label={label} hint={description} ariaLabel={props.t('config.topologyLayerToggle', { layer: label })}
            checked={layer.enabled} disabled={props.disabled} onChange={enabled => props.onEnabled(layer.id, enabled)} />
        })}
      </div>}
  </section>
}

function TaskAgentModelRows(props: {
  draft: Draft
  catalog: TaskAgentModelCatalog | null
  state: 'unavailable' | 'loading' | 'ready' | 'error'
  error: string | null
  disabled: boolean
  fullCatalogLoaded: boolean
  onLoadCatalog: () => void
  onEdit: (field: Field, value: string | boolean) => void
  onEditMany: (values: Partial<Draft>) => void
  t: MnemonTranslate
}): JSX.Element {
  const groups = props.catalog?.groups ?? []
  const group = groups.find(candidate => candidate.id === props.draft.taskAgentProvider)
  const inherited = props.catalog?.defaultSelection
    ?? (props.catalog?.effective?.source === 'fixed' ? undefined : props.catalog?.effective)
  const effective = props.draft.taskAgentModelMode === 'fixed'
    ? (props.draft.taskAgentProvider.trim() === '' || props.draft.taskAgentModel.trim() === '' ? undefined : { provider: props.draft.taskAgentProvider, model: props.draft.taskAgentModel })
    : inherited

  const chooseFixed = (): void => {
    const preferredProvider = props.draft.taskAgentProvider
      || inherited?.provider
      || groups[0]?.id
      || ''
    const models = groups.find(candidate => candidate.id === preferredProvider)?.models ?? []
    const preferredModel = props.draft.taskAgentModel
      || (inherited?.provider === preferredProvider ? inherited.model : undefined)
      || models[0]?.id
      || ''
    props.onEditMany({ taskAgentModelMode: 'fixed', taskAgentProvider: preferredProvider, taskAgentModel: preferredModel })
    if (!props.fullCatalogLoaded) props.onLoadCatalog()
  }
  const chooseProvider = (provider: string): void => {
    const models = groups.find(candidate => candidate.id === provider)?.models ?? []
    props.onEditMany({ taskAgentProvider: provider, taskAgentModel: models[0]?.id ?? '' })
  }

  const effectiveLine = <span className={css.effectiveRoute}>
    <span>{props.t('config.taskAgentEffective')}</span>
    {effective === undefined
      ? <small>{props.state === 'loading' ? props.t('config.taskAgentLoading') : props.t('config.taskAgentUnavailable')}</small>
      : <code>{effective.provider} / {effective.model}</code>}
  </span>

  return <>
    <SelectRow id="mnemon-task-agent" label={props.t('config.taskAgentTitle')} value={props.draft.taskAgentModelMode} disabled={props.disabled}
      hint={props.draft.taskAgentModelMode === 'fixed' ? props.t('config.taskAgentFixedHint') : props.t('config.taskAgentInheritHint')}
      onChange={mode => { if (mode === 'fixed') chooseFixed(); else props.onEditMany({ taskAgentModelMode: 'inherit' }) }}
      options={[
        { value: 'inherit', label: props.t('config.taskAgentInherit'), detail: props.t('config.taskAgentInheritHint') },
        { value: 'fixed', label: props.t('config.taskAgentFixed'), detail: props.t('config.taskAgentFixedHint'), ...(props.state === 'unavailable' ? { disabled: true } : {}) },
      ]} />
    <div className={css.rowDetail}>
      {props.draft.taskAgentModelMode === 'fixed' && <div className={css.fieldGrid}>
        <label>
          {props.t('config.taskAgentProvider')}
          <select aria-label={props.t('config.taskAgentProvider')} value={props.draft.taskAgentProvider} disabled={props.disabled || props.state !== 'ready'} onChange={event => chooseProvider(event.target.value)}>
            <option value="">{props.t('config.taskAgentChooseProvider')}</option>
            {props.draft.taskAgentProvider !== '' && !groups.some(candidate => candidate.id === props.draft.taskAgentProvider) && <option value={props.draft.taskAgentProvider}>{props.draft.taskAgentProvider}</option>}
            {groups.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
          </select>
        </label>
        <label>
          {props.t('config.taskAgentModel')}
          <select aria-label={props.t('config.taskAgentModel')} value={props.draft.taskAgentModel} disabled={props.disabled || props.state !== 'ready' || group === undefined} onChange={event => props.onEdit('taskAgentModel', event.target.value)}>
            <option value="">{props.t('config.taskAgentChooseModel')}</option>
            {props.draft.taskAgentModel !== '' && !group?.models.some(model => model.id === props.draft.taskAgentModel) && <option value={props.draft.taskAgentModel}>{props.draft.taskAgentModel}</option>}
            {(group?.models ?? []).map(model => <option key={model.id} value={model.id}>{model.name}{model.inputModalities?.includes('image') === true ? ` · ${props.t('config.taskAgentImageInput')}` : ''}</option>)}
          </select>
        </label>
      </div>}
      {effectiveLine}
      {props.state === 'error' && <p className={css.warning}>{props.t('config.taskAgentLoadFailed', { error: props.error ?? '' })}</p>}
      {(props.catalog?.failures.length ?? 0) > 0 && groups.length > 0 && <p className={css.warning}>{props.t('config.taskAgentPartial', { count: props.catalog!.failures.length })}</p>}
    </div>
  </>
}

function IdleReviewRows(props: { draft: Draft; disabled: boolean; onEditMany: (values: Partial<Draft>) => void; t: MnemonTranslate }): JSX.Element {
  const review = props.draft.idleReview
  const update = (values: Partial<ResolvedIdleReviewConfig>): void => props.onEditMany({ idleReview: { ...review, ...values } })
  return <>
    <ToggleRow id="mnemon-idle-review" label={props.t('config.reviewTitle')} ariaLabel={props.t('config.reviewEnabled')} hint={props.t('config.reviewDescription')} checked={review.enabled} disabled={props.disabled} onChange={enabled => update({ enabled })} />
    {review.enabled && <>
      <SelectRow id="mnemon-review-provider" label={props.t('config.reviewProvider')} value={review.provider} disabled={props.disabled} onChange={provider => update({ provider })} options={[
        { value: 'spawn', label: props.t('config.reviewSpawn') },
        { value: 'fork', label: props.t('config.reviewFork') },
      ]} />
      <SelectRow id="mnemon-review-fallback" label={props.t('config.reviewFallback')} value={review.fallback} disabled={props.disabled} onChange={fallback => update({ fallback })} options={[
        { value: 'spawn', label: props.t('config.reviewSpawn') },
        { value: 'skip', label: props.t('config.reviewSkip') },
      ]} />
      <SelectRow id="mnemon-review-teams" label={props.t('config.reviewAgentTeams')} hint={props.t('config.reviewTeamHint')} value={review.agentTeams} disabled={props.disabled} onChange={agentTeams => update({ agentTeams })} options={[
        { value: 'pause', label: props.t('config.reviewTeamPause') },
        { value: 'scoped', label: props.t('config.reviewTeamScoped') },
      ]} />
      <details className={css.advanced}>
        <summary>{props.t('config.reviewLimits')}<IconChevronDownOutlineRegular size={12} /></summary>
        <div className={css.fieldGrid}>
          {(['minIntervalMs', 'maxPerSession', 'maxContextChars', 'maxTokens'] as const).map(field => <label key={field}>{props.t(`config.review.${field}`)}<input type="number" step="1" value={review[field]} disabled={props.disabled} onChange={event => props.onEditMany({ idleReview: { ...review, [field]: Number(event.target.value) } })} /></label>)}
        </div>
      </details>
    </>}
  </>
}
