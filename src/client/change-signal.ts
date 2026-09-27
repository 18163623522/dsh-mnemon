/**
 * A revision other surfaces bump when something they cannot observe directly
 * changed, such as a component switched on DSH's Plugins page. Readers reload
 * their own data when the revision moves.
 */
export class MnemonChangeSignal {
  private revision = 0
  private readonly listeners = new Set<() => void>()

  readonly getSnapshot = (): number => this.revision

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  readonly bump = (): void => {
    this.revision += 1
    for (const listener of [...this.listeners]) listener()
  }
}
