import type { MemoryPluginEntryView, MemoryViewDashboard } from '../host/view-protocol.ts'

/** Shipped Source packages are named after the memory layer they serve. */
const SHIPPED_SOURCE_PREFIX = 'dsh-mnemon-source-'
/** An enhancement that fits whichever main Strategy offers its slot. */
const ANY_STRATEGY = '*'

/** How the memory components on the configuration page depend on each other right now. */
export interface MemoryComponentModel {
  /** Main Strategies; exactly one composes memory. */
  mains: MemoryPluginEntryView[]
  /** Optional behaviors added to the main Strategy. */
  enhancements: MemoryPluginEntryView[]
  /** The main Strategy the configuration names. */
  selected: MemoryPluginEntryView | undefined
  /**
   * The main Strategy composing memory now: the selected one while it runs,
   * otherwise the only main Strategy running. None while no main Strategy
   * runs, or while several run and the selected one does not.
   */
  composing: MemoryPluginEntryView | undefined
  /** Main Strategies that run beside the composing one and add nothing. */
  idle: MemoryPluginEntryView[]
  /** Running main Strategies, when none of them can compose because the selected one is not running. */
  contenders: MemoryPluginEntryView[]
}

const running = (entry: MemoryPluginEntryView): boolean => entry.enabled && entry.active

export function componentModel(dashboard: MemoryViewDashboard): MemoryComponentModel {
  const mains = dashboard.entries.filter(entry => entry.roles.includes('strategy') && entry.typeId !== undefined)
  const enhancements = dashboard.entries.filter(entry => entry.roles.includes('strategy-extension'))
  const selected = mains.find(entry => entry.typeId === dashboard.strategyTypeId)
  const others = mains.filter(entry => entry !== selected && running(entry))
  // The Host composes with the selected Strategy, or falls back to the only
  // other one installed. With several installed it cannot choose.
  const composing = selected !== undefined && running(selected) ? selected : others.length === 1 ? others[0] : undefined
  return {
    mains, enhancements, selected, composing,
    idle: composing === selected ? others : [],
    contenders: composing === undefined && others.length > 1 ? others : [],
  }
}

/** The Source component serving a memory layer, including one that is switched off and so has no registered type. */
export function sourceOf(dashboard: MemoryViewDashboard, layerId: string): MemoryPluginEntryView | undefined {
  const sources = dashboard.entries.filter(entry => entry.roles.includes('source'))
  return sources.find(entry => entry.typeId === layerId)
    ?? sources.find(entry => entry.typeId === undefined && entry.packageName === SHIPPED_SOURCE_PREFIX + layerId)
}

export interface UnmetRequirement {
  requirement: string
  /** Installed components that would provide it once switched on. */
  providers: MemoryPluginEntryView[]
}

/** What a switched-on component requires that no switched-on component provides. */
export function unmetRequirements(dashboard: MemoryViewDashboard, entry: MemoryPluginEntryView): UnmetRequirement[] {
  const provides = (candidate: MemoryPluginEntryView, requirement: string): boolean => candidate.provides.some(capability => capability.id === requirement)
  return entry.requires.flatMap(requirement => dashboard.entries.some(candidate => candidate.enabled && provides(candidate, requirement))
    ? []
    : [{ requirement, providers: dashboard.entries.filter(candidate => !candidate.enabled && provides(candidate, requirement)) }])
}

/** Whether the composing main Strategy takes this enhancement. */
export function enhancementApplies(entry: MemoryPluginEntryView, composing: MemoryPluginEntryView | undefined): boolean {
  return composing !== undefined && (entry.strategyTypeId === undefined || entry.strategyTypeId === ANY_STRATEGY || entry.strategyTypeId === composing.typeId)
}
