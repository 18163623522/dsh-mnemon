import { memo, useCallback, useEffect, useState, useSyncExternalStore, type JSX, type MouseEvent as ReactMouseEvent } from 'react'
import type { ClientConnectionHandle, TurnMemoryActivity } from "../host/protocol.ts"
import { MnemonClient } from './api.ts'
import { dispatchMnemonAnchor, type MnemonAnchorPage } from './anchor.ts'
import type { MnemonKey } from './locales.ts'
import type { MnemonClientContext } from './dsh-context.ts'
import css from './MnemonTurnTail.module.css'
import { IconChevronDownOutlineRegular, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import { MemoryIcon } from './memory-icon.tsx'

interface MnemonTurnTailProps {
  /** Engine-owned closing Turn boundary (TurnLocation on the wire). */
  turn: unknown
  seq: number
  openFile: (path: string) => void
  /** Injected by the slot host: the session this tail belongs to. */
  sessionId?: string
  connection: ClientConnectionHandle
  localeRuntime: Pick<MnemonClientContext['locale'], 'getSnapshot' | 'subscribe'>
  t: (key: MnemonKey, params?: Record<string, unknown>) => string
}

function turnNumber(turn: unknown): number | undefined {
  const value = (turn as { turn?: unknown } | null)?.turn
  return typeof value === 'number' ? value : undefined
}

function isClosedTurn(turn: unknown): boolean {
  return (turn as { status?: unknown } | null)?.status === 'closed'
}

/** Route a settled tool name to the workbench page that explains its effect. */
export function memoryPageForTool(name: string): MnemonAnchorPage {
  if (name === 'mnemon_document_search' || name === 'mnemon_document_manage' || name === 'mnemon_document_create') return 'documents/library'
  if (name === 'mnemon_runtime_memory') return 'runtime/entries'
  if (name === 'mnemon_recall' || name === 'mnemon_related') return 'memory-spaces/explore'
  if (name === 'mnemon_status') return 'status'
  return 'memory-spaces/spaces'
}

/** What each memory tool did, as its chip says it; another tool keeps its own name. */
const TOOL_LABELS: Readonly<Record<string, MnemonKey>> = {
  mnemon_recall: 'turnTail.tool.recall',
  mnemon_related: 'turnTail.tool.related',
  mnemon_document_search: 'turnTail.tool.documentSearch',
  mnemon_document_manage: 'turnTail.tool.documentManage',
  mnemon_document_create: 'turnTail.tool.documentCreate',
  mnemon_runtime_memory: 'turnTail.tool.runtime',
  mnemon_remember: 'turnTail.tool.remember',
  mnemon_link: 'turnTail.tool.link',
  mnemon_forget: 'turnTail.tool.forget',
  mnemon_status: 'turnTail.tool.status',
  mnemon_memory_bodies: 'turnTail.tool.spaces',
  mnemon_memory_body_create: 'turnTail.tool.spaceCreate',
  mnemon_memory_body_update: 'turnTail.tool.spaceUpdate',
  mnemon_memory_body_merge: 'turnTail.tool.spaceMerge',
  mnemon_view_route: 'turnTail.tool.viewRoute',
  mnemon_view_action: 'turnTail.tool.viewAction',
}

/** One chip per tool, in the order the turn first used it, with how many times it did. */
export function turnTools(names: readonly string[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>()
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1)
  return [...counts].map(([name, count]) => ({ name, count }))
}

/** One-line memory-activity bar under a completed turn; hides when the turn touched no memory. */
export const MnemonTurnTail = memo(function MnemonTurnTail({ turn, seq, sessionId, connection, localeRuntime, t }: MnemonTurnTailProps): JSX.Element | null {
  const subscribeLocale = useCallback((listener: () => void) => localeRuntime.subscribe(listener), [localeRuntime])
  const getLocale = useCallback(() => localeRuntime.getSnapshot(), [localeRuntime])
  useSyncExternalStore(subscribeLocale, getLocale, getLocale)
  const [activity, setActivity] = useState<TurnMemoryActivity | null | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const number = turnNumber(turn)
  // The turn-tail list renders every entry, so the entry itself waits for the closing Turn.
  const closed = isClosedTurn(turn)

  useEffect(() => {
    if (!closed || number === undefined) {
      setActivity(null)
      return
    }
    let alive = true
    const client = new MnemonClient(connection, sessionId)
    client.turnActivity(number, seq)
      .then(result => { if (alive) setActivity(result) })
      .catch(() => { if (alive) setActivity(null) })
    return () => { alive = false }
  }, [connection, sessionId, number, seq, closed])

  if (!closed || number === undefined) return null
  if (activity === undefined || activity === null) return null

  const openTool = (name: string, event: ReactMouseEvent): void => {
    event.stopPropagation()
    dispatchMnemonAnchor({ page: memoryPageForTool(name), ...(sessionId === undefined ? {} : { sessionId }) })
  }

  return (
    <div className={css.root} data-open={open || undefined}>
      <button type="button" className={css.bar} aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <span className={css.mark}><MemoryIcon size={14} /></span>
        <span className={css.label}>{t('turnTail.label')}</span>
        <span className={css.metrics}>
          {activity.recalls > 0 && <span>{t('turnTail.recall', { count: activity.recalls })}</span>}
          {activity.writes > 0 && <span>{t('turnTail.write', { count: activity.writes })}</span>}
          {activity.documentSearches > 0 && <span>{t('turnTail.documents', { count: activity.documentSearches })}</span>}
          {activity.inspections > 0 && <span>{t('turnTail.inspect', { count: activity.inspections })}</span>}
          {activity.failures > 0 && <span className={css.failureMetric}>{t('turnTail.failed', { count: activity.failures })}</span>}
        </span>
        <IconChevronDownOutlineRegular size={12} className={`${css.chevron} ${open ? css.chevronOpen : ''}`} />
      </button>
      {open && (
        <div className={css.details}>
          <span className={css.detailLabel}>{t('turnTail.toolList')}</span>
          <div className={css.tools}>
            {turnTools(activity.names).map(({ name, count }) => {
              const label = TOOL_LABELS[name] === undefined ? name : t(TOOL_LABELS[name])
              return (
                <Tooltip key={name} label={name} side="bottom">
                  <button
                    type="button"
                    className={css.toolChip}
                    aria-label={t('turnTail.openTool', { tool: label })}
                    onClick={event => openTool(name, event)}
                  >
                    {label}{count > 1 && <span className={css.toolCount}>×{count}</span>}
                  </button>
                </Tooltip>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
})
