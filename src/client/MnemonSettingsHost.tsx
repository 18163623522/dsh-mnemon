import { useCallback, useSyncExternalStore } from 'react'
import type { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import type { PluginConfigViewProps } from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import { MnemonSettingsCard, type MnemonSettingsCardProps } from './MnemonSettingsCard.tsx'
import type { MnemonClientContext } from './dsh-context.ts'
import { useMnemonSessionId, type MnemonSessionBinding } from './session-binding.ts'

interface MnemonSettingsHostProps extends Omit<MnemonSettingsCardProps, 'sessionId' | 'workspaceId' | 'workspaceLabel' | 'language'> {
  /** The DSH Plugins page renders a bundle's configuration as its `page` view only. */
  view: PluginConfigViewProps['view']
  currentSession: MnemonSessionBinding
  localeRuntime: LocaleRuntime
  sessions: MnemonClientContext['sessions']
  workspaces: MnemonClientContext['workspaces']
}

/** The dsh-mnemon bundle page body; root-slot injection is cached, so session and workspace stay live here. */
export function MnemonSettingsHost({ view, currentSession, sessions, workspaces, localeRuntime, ...props }: MnemonSettingsHostProps): JSX.Element | null {
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
  if (view !== 'page') return null
  const cwd = sessionId === undefined ? undefined : Object.entries(catalog.byId).find(([id]) => id === sessionId)?.[1]?.cwd
  const normalizePath = (value: string): string => value.replace(/[\\/]+$/u, '')
  const workspace = sessionId === undefined
    ? workspaceList.items[0]
    : cwd === undefined ? undefined : workspaceList.items.find(candidate => normalizePath(candidate.path) === normalizePath(cwd))
  return <MnemonSettingsCard
    {...props}
    language={language}
    {...(sessionId === undefined ? {} : { sessionId })}
    {...(workspace === undefined ? {} : { workspaceId: String(workspace.workspaceId), workspaceLabel: workspace.title })}
  />
}
