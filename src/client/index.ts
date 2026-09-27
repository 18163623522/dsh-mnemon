import {
  MNEMON_SETTINGS_NAMESPACE,
  MNEMON_UI_SETTINGS_NAMESPACE,
  normalizeDisplayMode,
  type ClientConnectionHandle,
  type Config,
  type InteractionConfig,
  type MnemonDisplayMode,
} from "../host/protocol.ts"
import { MnemonSettingsHost } from './MnemonSettingsHost.tsx'
import { MnemonTurnTail } from './MnemonTurnTail.tsx'
import { MnemonPluginActions, MNEMON_PACKAGE_NAME } from './MnemonPluginActions.tsx'
import { MnemonSaveAction } from './MnemonSaveAction.tsx'
import { MnemonActionSeat } from './action-seat.ts'
import { en, zh, type MnemonKey } from './locales.ts'
import { MnemonSettingsScope } from './settings.ts'
import type { MnemonClientContext } from "./dsh-context.ts"
import {
  createMemorySourcePageDirectory,
  MNEMON_SOURCE_PAGE_SLOT,
} from './source-pages.tsx'
import { MnemonBetterSidebarSeat } from './better-sidebar-seat.ts'
import {
  MnemonSidebarWorkspaceHost,
  MnemonBuiltinWorkspaceHost,
} from './workspace-mount.tsx'
import { MnemonNativeSidebarSeat } from './native-sidebar-seat.ts'
import { mountMnemonSidebarNavigation } from './native-sidebar.tsx'
import { mountBetterSidebarTab } from './better-sidebar.tsx'
import { MnemonWorkspaceController } from './workspace-controller.ts'
import { MNEMON_ANCHOR_EVENT, type MnemonAnchor } from './anchor.ts'
import { mountSubagentTokenUsageOverride } from './subagent-token-usage.tsx'
import { isRecord } from './is-record.ts'

export * from './extension-sdk.ts'

export const inject = ['slots', 'sessions', 'workspaces', 'uiSession', 'connection', 'locale', 'layout']

/** Interaction surfaces: slot name, settings toggle, and the registrations it owns. */
type MnemonNamespace = 'mnemon'
type InteractionSlot = 'conversation.chat.turnTail' | 'conversation.chat.assistant-actions'
type InteractionRegister = (ctx: MnemonClientContext, namespace: MnemonNamespace, translate: (key: MnemonKey, params?: Record<string, unknown>) => string, settings: MnemonSettingsScope<Config>) => () => void

interface InteractionUnit {
  slot: InteractionSlot
  enabled: (value: unknown) => boolean
  register: InteractionRegister
}

const INTERACTION_UNITS: Record<'turnBar' | 'saveAction', InteractionUnit> = {
  turnBar: {
    slot: 'conversation.chat.turnTail',
    enabled: (value: unknown): boolean => enabledOf(value, 'turnBar'),
    register(ctx: MnemonClientContext, namespace: MnemonNamespace, translate: (key: MnemonKey, params?: Record<string, unknown>) => string): () => void {
      return ctx.slots.register({
        name: 'conversation.chat.turnTail',
        id: 'dsh-mnemon/turn-tail',
        locale: namespace,
        inject: (sessionId: unknown): { sessionId?: string; connection: ClientConnectionHandle; localeRuntime: MnemonClientContext['locale']; t: (key: MnemonKey, params?: Record<string, unknown>) => string } => ({
          ...(typeof sessionId === 'string' && sessionId !== '' ? { sessionId } : {}),
          connection: ctx.connection,
          localeRuntime: ctx.locale,
          t: translate as (key: MnemonKey, params?: Record<string, unknown>) => string,
        }),
      }, MnemonTurnTail)
    },
  },
  saveAction: {
    slot: 'conversation.chat.assistant-actions',
    enabled: (value: unknown): boolean => enabledOf(value, 'saveAction'),
    register(ctx: MnemonClientContext, namespace: MnemonNamespace, translate: (key: MnemonKey, params?: Record<string, unknown>) => string, settings: MnemonSettingsScope<Config>): () => void {
      return ctx.slots.register({
        name: 'conversation.chat.assistant-actions',
        id: 'mnemon-save',
        order: 90,
        locale: namespace,
        inject: (sessionId: unknown): { sessionId?: string; connection: ClientConnectionHandle; settingsScope: MnemonSettingsScope<Config>; localeRuntime: MnemonClientContext['locale']; t: (key: MnemonKey, params?: Record<string, unknown>) => string } => ({
          ...(typeof sessionId === 'string' && sessionId !== '' ? { sessionId } : {}),
          connection: ctx.connection,
          settingsScope: settings,
          localeRuntime: ctx.locale,
          t: translate as (key: MnemonKey, params?: Record<string, unknown>) => string,
        }),
      }, MnemonSaveAction)
    },
  },
}

type InteractionUnitKey = keyof typeof INTERACTION_UNITS

/** Ready snapshots default each interaction on; loading has no value and mounts nothing. */
function enabledOf(value: unknown, key: 'turnBar' | 'saveAction'): boolean {
  return isRecord(value) && value[key] !== false
}

/** Actions one surface offers another: the configuration page under Plugins, and the workspace in its placement. */
interface MnemonSeats {
  configuration: MnemonActionSeat
  workspace: MnemonActionSeat
}

/** The DSH describe revision of one Host entry, as `ctx.configForms` reports it. */
interface HostSettingsRevision {
  getSnapshot(): { revision: number | undefined }
  subscribe(listener: () => void): () => void
}

/**
 * Re-read Mnemon settings when DSH reports a newer revision of the `mnemon`
 * entry, such as a profile edit or another page's save. Pages without a Host
 * settings mirror (remote pages) never report one and keep their own reads.
 */
function followHostSettings(form: HostSettingsRevision, scopes: ReadonlyArray<MnemonSettingsScope<Config> | MnemonSettingsScope<InteractionConfig>>): () => void {
  let seen = form.getSnapshot().revision
  return form.subscribe(() => {
    const revision = form.getSnapshot().revision
    if (revision === undefined || revision === seen) return
    seen = revision
    for (const scope of scopes) if (scope.getSnapshot().revision !== revision) void scope.refresh()
  })
}

function mountSidebarMemoryView(ctx: MnemonClientContext, settings: MnemonSettingsScope<Config>, namespace: MnemonNamespace, translate: (key: MnemonKey, params?: Record<string, unknown>) => string, seats: MnemonSeats): () => void {
  const controller = new MnemonWorkspaceController()
  let launcher: ReturnType<typeof mountMnemonSidebarNavigation> | undefined
  const navigation = {
    open: () => { if (launcher === undefined) controller.open(); else launcher.open() },
    close: () => { if (launcher === undefined) controller.close(); else launcher.close() },
  }
  const sourcePageDirectory = createMemorySourcePageDirectory(ctx)
  const betterSidebarSeat = new MnemonBetterSidebarSeat()
  const nativeSidebarSeat = new MnemonNativeSidebarSeat()
  const slotName = 'shell.overlay'
  const disposeView = ctx.slots.inject(slotName, () => ctx.slots.register({
    name: slotName,
    id: 'mnemon',
    order: 30,
    label: () => translate('tab.label'),
    locale: namespace,
    children: {
      [MNEMON_SOURCE_PAGE_SLOT]: { kind: 'list', scope: 'root' },
    },
    inject: () => ({
      connection: ctx.connection,
      settingsScope: settings,
      sessions: ctx.sessions,
      workspaces: ctx.workspaces,
      currentSession: ctx.uiSession.adapter.current,
      localeRuntime: ctx.locale,
      sourcePageDirectory,
      navigation,
      controller,
      betterSidebarSeat,
      nativeSidebarSeat,
      configuration: seats.configuration,
      t: translate,
    }),
  }, MnemonSidebarWorkspaceHost))
  let disposeBetterSidebar: (() => void) | undefined
  let withdrawWorkspace: (() => void) | undefined
  let listening = false
  let disposed = false
  const openMemoryView = (): void => { navigation.open() }
  const dispose = (): void => {
    if (disposed) return
    disposed = true
    withdrawWorkspace?.()
    try {
      launcher?.dispose()
    } finally {
      if (listening) window.removeEventListener(MNEMON_ANCHOR_EVENT, openMemoryView)
      try {
        disposeBetterSidebar?.()
      } finally {
        disposeView()
      }
    }
  }
  try {
    disposeBetterSidebar = mountBetterSidebarTab(ctx, translate, betterSidebarSeat)
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      window.addEventListener(MNEMON_ANCHOR_EVENT, openMemoryView)
      listening = true
      launcher = mountMnemonSidebarNavigation(ctx, translate, controller, nativeSidebarSeat)
    }
    withdrawWorkspace = seats.workspace.provide(openMemoryView)
    return dispose
  } catch (error) {
    dispose()
    throw error
  }
}

/** DSH supplies the owning session; Source pages retain the same render contract. */
function mountBuiltinMemoryView(ctx: MnemonClientContext, settings: MnemonSettingsScope<Config>, namespace: MnemonNamespace, translate: (key: MnemonKey, params?: Record<string, unknown>) => string, seats: MnemonSeats): () => void {
  const sourcePageDirectory = createMemorySourcePageDirectory(ctx)
  const disposeView = ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'mnemon',
    order: 30,
    label: () => translate('tab.label'),
    locale: namespace,
    children: {
      [MNEMON_SOURCE_PAGE_SLOT]: { kind: 'list', scope: 'root' },
    },
    inject: sessionId => ({
      connection: ctx.connection,
      settingsScope: settings,
      sessionId,
      localeRuntime: ctx.locale,
      sourcePageDirectory,
      configuration: seats.configuration,
      t: translate,
    }),
  }, MnemonBuiltinWorkspaceHost))
  if (typeof window === 'undefined' || typeof document === 'undefined') return disposeView
  const selectMemoryTab = (): boolean => {
    const label = translate('tab.label').trim()
    const eligible = (candidate: HTMLElement): boolean => !candidate.hasAttribute('disabled')
      && candidate.getAttribute('aria-disabled') !== 'true' && candidate.closest('[hidden], [aria-hidden="true"]') === null
    const conversations = [...document.querySelectorAll<HTMLElement>('[data-slot="main.conversation"]')].filter(eligible)
    if (conversations.length !== 1) return false
    const tabs = [...conversations[0]!.querySelectorAll<HTMLElement>('[role="tab"]')]
      .filter(candidate => candidate.textContent?.trim() === label && eligible(candidate))
    // Split panes can expose identically labelled tabs without a public
    // session marker. Keep the anchor pending instead of choosing a pane.
    if (tabs.length !== 1) return false
    tabs[0]!.click()
    return true
  }
  const openView = (event: Event): void => {
    const sessionId = (event as CustomEvent<MnemonAnchor>).detail?.sessionId
    const mainSessionId = ctx.uiSession.adapter.current.getSnapshot().key
    if (mainSessionId === undefined || (sessionId !== undefined && sessionId !== mainSessionId)) return
    selectMemoryTab()
  }
  window.addEventListener(MNEMON_ANCHOR_EVENT, openView)
  // Another main panel, such as Plugins, first returns to the conversation,
  // whose tabs render a frame or more later.
  let frame: number | undefined
  const openFromPanel = (): void => {
    ctx.layout.selectPanel(null)
    let attempts = 0
    const attempt = (): void => {
      frame = undefined
      if (selectMemoryTab() || (attempts += 1) >= 30) return
      frame = requestAnimationFrame(attempt)
    }
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = requestAnimationFrame(attempt)
  }
  // Builtin lives in a conversation, so it can open only while one is current.
  const current = ctx.uiSession.adapter.current
  let withdrawWorkspace: (() => void) | undefined
  const followSession = (): void => {
    const open = current.getSnapshot().key !== undefined
    if (open && withdrawWorkspace === undefined) withdrawWorkspace = seats.workspace.provide(openFromPanel)
    else if (!open && withdrawWorkspace !== undefined) { withdrawWorkspace(); withdrawWorkspace = undefined }
  }
  const unsubscribeSession = current.subscribe(followSession)
  followSession()
  return () => {
    unsubscribeSession()
    withdrawWorkspace?.()
    if (frame !== undefined) cancelAnimationFrame(frame)
    window.removeEventListener(MNEMON_ANCHOR_EVENT, openView)
    disposeView()
  }
}

/** Mount the memory workspace plus the optional in-conversation interaction surfaces. */
export function apply(rawContext: unknown): void {
  const ctx = rawContext as MnemonClientContext
  const settings = new MnemonSettingsScope<Config>(ctx.connection, MNEMON_SETTINGS_NAMESPACE)
  const interactionSettings = new MnemonSettingsScope<InteractionConfig>(ctx.connection, MNEMON_UI_SETTINGS_NAMESPACE)
  const seats: MnemonSeats = { configuration: new MnemonActionSeat(), workspace: new MnemonActionSeat() }
  const namespace: MnemonNamespace = 'mnemon'
  ctx.effect(() => ctx.locale.register(namespace, { zh, en }), 'dsh-mnemon: locale dictionaries')
  const translate = ctx.locale.bind(namespace)
  // The Plugins page provides its navigation while it lives; the memory
  // workspace links to its configuration only then.
  ctx.inject(['pluginNavigation'], inner => {
    inner.effect(() => seats.configuration.provide(() => { inner.pluginNavigation.openBundle(MNEMON_PACKAGE_NAME) }), 'dsh-mnemon: configuration entry')
  })
  // DSH mirrors the Host settings document on loopback pages; follow its
  // revision of the `mnemon` entry so edits made elsewhere show up live.
  ctx.inject(['configForms'], inner => {
    inner.effect(() => followHostSettings(inner.configForms.get(MNEMON_SETTINGS_NAMESPACE), [settings, interactionSettings]), 'dsh-mnemon: DSH settings revisions')
  })
  ctx.slots.inject(
    'conversation.session.header.lineage',
    () => mountSubagentTokenUsageOverride(ctx),
  )
  let activeMemoryWorkspace: { mode: MnemonDisplayMode; dispose: () => void } | undefined
  const reconcileMemoryWorkspace = (): void => {
    const snapshot = settings.getSnapshot()
    const mode = snapshot.status === 'loading' || snapshot.value?.tabEnabled === false
      ? undefined
      : normalizeDisplayMode(snapshot.value?.displayMode)
    if (activeMemoryWorkspace?.mode === mode) return
    activeMemoryWorkspace?.dispose()
    activeMemoryWorkspace = mode === undefined ? undefined : {
      mode,
      dispose: mode === 'builtin'
        ? mountBuiltinMemoryView(ctx, settings, namespace, translate, seats)
        : mountSidebarMemoryView(ctx, settings, namespace, translate, seats),
    }
  }
  ctx.effect(() => {
    const unsubscribe = settings.subscribe(reconcileMemoryWorkspace)
    reconcileMemoryWorkspace()
    return () => {
      unsubscribe()
      activeMemoryWorkspace?.dispose()
      activeMemoryWorkspace = undefined
    }
  }, 'dsh-mnemon: memory workspace entry')
  // DSH 0.1.7 edits a plugin's configuration on its own page under Plugins;
  // Settings keeps only the read-only plugin inventory. The whole Mnemon
  // configuration is the dsh-mnemon bundle's page, between its description
  // and its components.
  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config',
    key: MNEMON_PACKAGE_NAME,
    locale: namespace,
    inject: () => ({
      scope: settings,
      interactionScope: interactionSettings,
      connection: ctx.connection,
      sessions: ctx.sessions,
      workspaces: ctx.workspaces,
      currentSession: ctx.uiSession.adapter.current,
      localeRuntime: ctx.locale,
      t: translate,
    }),
  }, MnemonSettingsHost))
  ctx.slots.inject('plugins.detail.actions', () => ctx.slots.register({
    name: 'plugins.detail.actions',
    id: 'dsh-mnemon/open-workspace',
    locale: namespace,
    inject: () => ({ workspace: seats.workspace, t: translate }),
  }, MnemonPluginActions))

  // In-conversation interaction surfaces default on and are bound live: each
  // settings change registers or disposes the slot contributions without a
  // reload. Until the snapshot loads, nothing registers (conservative default).
  const active = new Map<InteractionUnitKey, () => void>()
  const reconcile = (): void => {
    const value = interactionSettings.getSnapshot().value
    for (const key of Object.keys(INTERACTION_UNITS) as InteractionUnitKey[]) {
      const unit = INTERACTION_UNITS[key]
      const enabled = unit.enabled(value)
      if (enabled && !active.has(key)) {
        active.set(key, ctx.slots.inject(unit.slot, () => unit.register(ctx, namespace, translate, settings)))
      } else if (!enabled && active.has(key)) {
        active.get(key)!()
        active.delete(key)
      }
    }
  }
  ctx.effect(() => {
    const unsubscribe = interactionSettings.subscribe(reconcile)
    reconcile()
    return () => {
      unsubscribe()
      for (const dispose of [...active.values()].reverse()) dispose()
      active.clear()
    }
  }, 'dsh-mnemon: interaction surfaces')
}
