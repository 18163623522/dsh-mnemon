import { createElement, type ReactNode } from 'react'

/**
 * A component's own settings, on its page: keyed by the component's package
 * name, rendered after the page's generated state, relations and options.
 */
export const MNEMON_COMPONENT_SETTINGS_SLOT = 'mnemon.component.settings' as const

const PACKAGE_NAME = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/u

/** What the host tells a component's settings about the page they are on. */
export interface MemoryComponentSettingsProps {
  /** The component the page is about, as the host shows it. */
  component: {
    packageName: string
    label: string
    /** Whether the component is switched on. */
    enabled: boolean
  }
  /** Whether the configuration can be written now; settings stay read-only otherwise. */
  writable: boolean
  /** The active DSH locale id. */
  language: string
  /** The conversation and workspace the page was opened for, when there is one. */
  sessionId?: string
  workspace?: { id: string; label?: string }
}

export type MemoryComponentSettingsComponent = (props: MemoryComponentSettingsProps) => ReactNode

/** Everything one component adds to dsh-mnemon's interface beyond its declaration. */
export interface MemoryComponentUIContribution {
  /** The npm package name the component's plugin declaration names. */
  packageName: string
  /** Its own settings, shown on its page. Each saves on its own. */
  settings?: MemoryComponentSettingsComponent
}

/** The DSH Slot capability narrowed to the component regions. */
export interface MemoryComponentUIContext {
  slots: {
    inject(name: typeof MNEMON_COMPONENT_SETTINGS_SLOT, setup: () => () => void): () => void
    register(options: { name: typeof MNEMON_COMPONENT_SETTINGS_SLOT; key: string }, component: MemoryComponentSettingsComponent): () => void
  }
}

/**
 * Register a component's interface into the regions dsh-mnemon declares, the
 * way shipped components do. Registration waits for the regions to exist and
 * is released by the returned function.
 */
export function installMemoryComponentUI(ctx: MemoryComponentUIContext, contribution: MemoryComponentUIContribution): () => void {
  if (!PACKAGE_NAME.test(contribution.packageName)) throw new Error('memory component UI requires the package name of the component')
  const settings = contribution.settings
  if (settings === undefined) throw new Error('memory component UI contributes nothing: ' + contribution.packageName)
  return ctx.slots.inject(MNEMON_COMPONENT_SETTINGS_SLOT, () => ctx.slots.register({
    name: MNEMON_COMPONENT_SETTINGS_SLOT,
    key: contribution.packageName,
  }, props => createElement(settings, props)))
}

interface ComponentSettingsDirectoryContext {
  slots: {
    getVersion(name: typeof MNEMON_COMPONENT_SETTINGS_SLOT): number
    entriesOfSlot(name: typeof MNEMON_COMPONENT_SETTINGS_SLOT): readonly { options: { key?: string } }[]
    subscribe(name: typeof MNEMON_COMPONENT_SETTINGS_SLOT, listener: () => void): () => void
  }
}

/** The components that registered settings, as the pages that show them need to know. */
export interface ComponentSettingsDirectory {
  getSnapshot(): ReadonlySet<string>
  subscribe(listener: () => void): () => void
}

/** Thin adapter over the DSH child Slot: it keeps no registry of its own. */
export function createComponentSettingsDirectory(ctx: ComponentSettingsDirectoryContext): ComponentSettingsDirectory {
  let version = -1
  let snapshot: ReadonlySet<string> = new Set()
  const read = (): ReadonlySet<string> => {
    const current = ctx.slots.getVersion(MNEMON_COMPONENT_SETTINGS_SLOT)
    if (current === version) return snapshot
    version = current
    snapshot = new Set(ctx.slots.entriesOfSlot(MNEMON_COMPONENT_SETTINGS_SLOT).flatMap(entry => entry.options.key === undefined ? [] : [entry.options.key]))
    return snapshot
  }
  return {
    getSnapshot: read,
    subscribe: listener => ctx.slots.subscribe(MNEMON_COMPONENT_SETTINGS_SLOT, () => { read(); listener() }),
  }
}
