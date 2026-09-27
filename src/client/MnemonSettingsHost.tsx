import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import type { PluginConfigViewProps } from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type { PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
import { MNEMON_COMPONENT_SETTINGS_SLOT, type ComponentSettingsDirectory } from './component-ui.tsx'
import { MnemonSettingsCard, type ComponentSettingsSource, type MnemonSettingsCardProps } from './MnemonSettingsCard.tsx'
import type { MnemonClientContext } from './dsh-context.ts'
import { useMnemonSessionId, type MnemonSessionBinding } from './session-binding.ts'

interface MnemonSettingsHostProps extends Omit<MnemonSettingsCardProps, 'sessionId' | 'workspaceId' | 'workspaceLabel' | 'language' | 'componentSettings'>, Partial<PropsRenderSlots<typeof MNEMON_COMPONENT_SETTINGS_SLOT>> {
  /** The DSH Plugins page renders a bundle's configuration as its `page` view only. */
  view: PluginConfigViewProps['view']
  currentSession: MnemonSessionBinding
  localeRuntime: LocaleRuntime
  sessions: MnemonClientContext['sessions']
  workspaces: MnemonClientContext['workspaces']
  /** The components that contributed settings to their pages. */
  componentSettingsDirectory?: ComponentSettingsDirectory
}

/** The dsh-mnemon bundle page body; root-slot injection is cached, so session and workspace stay live here. */
export function MnemonSettingsHost({ view, currentSession, sessions, workspaces, localeRuntime, componentSettingsDirectory, renderSlot, ...props }: MnemonSettingsHostProps): JSX.Element | null {
  const sessionId = useMnemonSessionId(currentSession)
  const subscribeSessions = useCallback((listener: () => void) => sessions.list.subscribe(listener), [sessions.list])
  const getSessions = useCallback(() => sessions.list.getSnapshot(), [sessions.list])
  const subscribeWorkspaces = useCallback((listener: () => void) => workspaces.list.subscribe(listener), [workspaces.list])
  const getWorkspaces = useCallback(() => workspaces.list.getSnapshot(), [workspaces.list])
  const subscribeLocale = useCallback((listener: () => void) => localeRuntime.subscribe(listener), [localeRuntime])
  const getLanguage = useCallback((): string => localeRuntime.getSnapshot().active, [localeRuntime])
  const language = useSyncExternalStore(subscribeLocale, getLanguage, getLanguage)
  const catalog = useSyncExternalStore(subscribeSessions, getSessions, getSessions)
  const workspaceList = useSyncExternalStore(subscribeWorkspaces, getWorkspaces, getWorkspaces)
  const subscribeDirectory = useCallback((listener: () => void) => componentSettingsDirectory?.subscribe(listener) ?? (() => {}), [componentSettingsDirectory])
  const getDirectory = useCallback(() => componentSettingsDirectory?.getSnapshot(), [componentSettingsDirectory])
  const contributed = useSyncExternalStore(subscribeDirectory, getDirectory, getDirectory)
  // Each component's page renders the settings it registered, keyed by its package name.
  const componentSettings = useMemo<ComponentSettingsSource | undefined>(() => renderSlot === undefined || contributed === undefined ? undefined : {
    has: packageName => contributed.has(packageName),
    render: (entry, page) => renderSlot(MNEMON_COMPONENT_SETTINGS_SLOT, {
      component: { packageName: entry.packageName, label: page.label, enabled: page.enabled },
      writable: page.writable, language: page.language,
      ...(page.sessionId === undefined ? {} : { sessionId: page.sessionId }),
      ...(page.workspace === undefined ? {} : { workspace: page.workspace }),
    }, { entryKey: entry.packageName, fallback: null }),
  }, [renderSlot, contributed])
  if (view !== 'page') return null
  const cwd = sessionId === undefined ? undefined : Object.entries(catalog.byId).find(([id]) => id === sessionId)?.[1]?.cwd
  const normalizePath = (value: string): string => value.replace(/[\\/]+$/u, '')
  const workspace = sessionId === undefined
    ? workspaceList.items[0]
    : cwd === undefined ? undefined : workspaceList.items.find(candidate => normalizePath(candidate.path) === normalizePath(cwd))
  return <MnemonSettingsCard
    {...props}
    {...(componentSettings === undefined ? {} : { componentSettings })}
    language={language}
    {...(sessionId === undefined ? {} : { sessionId })}
    {...(workspace === undefined ? {} : { workspaceId: String(workspace.workspaceId), workspaceLabel: workspace.title })}
  />
}
