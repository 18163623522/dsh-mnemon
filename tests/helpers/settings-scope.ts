import { vi } from 'vitest'
import type { ClientSettingsScope, ClientSettingsSnapshot } from '../../src/host/protocol.ts'

/**
 * Settings scope fake over one published snapshot. Reads go through the
 * receiver like DSH's own scopes, so an unbound read fails the test; writes
 * reach `mutate`, which callers pass in when they assert on it.
 */
export function settingsScope<T>(snapshot: ClientSettingsSnapshot<T>, mutate: ClientSettingsScope<T>['mutate'] = vi.fn(async () => {})) {
  return {
    snapshot,
    getSnapshot() { return this.snapshot },
    subscribe: () => () => {},
    mutate,
  } satisfies ClientSettingsScope<T> & { snapshot: ClientSettingsSnapshot<T> }
}
