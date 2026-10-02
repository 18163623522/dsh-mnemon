import { describe, expect, it, vi } from 'vitest'
import type { HostAgent, HostPreStepDecision, HostSubagentRun, HostUserMessage } from '../src/host/dsh.ts'
import { CONTINUATION_TEXT, startWithContinuationTurns } from '../src/host/continuation-turn.ts'

type PreStep = (payload: { step: number; signal: AbortSignal }, next: () => Promise<HostPreStepDecision>) => Promise<HostPreStepDecision>

function host() {
  const listeners = new Map<string, Set<(...args: unknown[]) => unknown>>()
  const released = vi.fn()
  const owners = new Map<string, HostAgent>()
  const value = {
    agents: { isOwnedBy: (id: string, parent: HostAgent) => owners.get(id) === parent },
    on: vi.fn((name: string, listener: (...args: unknown[]) => unknown) => {
      const set = listeners.get(name) ?? new Set()
      set.add(listener)
      listeners.set(name, set)
      return () => { set.delete(listener); released(name) }
    }),
  }
  const created = (agent: HostAgent, parent: HostAgent) => {
    owners.set(agent.id, parent)
    for (const listener of listeners.get('agent/created') ?? []) listener({ agent })
  }
  return { value, created, released, observers: () => listeners.get('agent/created')?.size ?? 0 }
}

function agent(id: string) {
  const handlers: Array<{ handler: PreStep; options: unknown }> = []
  const stop = vi.fn()
  const value = { id, ctx: { on: vi.fn((name: string, handler: PreStep, options?: unknown) => {
    if (name === 'agent/pre-step') handlers.push({ handler, options })
    return stop
  }) } } as unknown as HostAgent
  return { value, handlers, stop }
}

function run(id: string, child?: HostAgent): HostSubagentRun & { disposed: ReturnType<typeof vi.fn> } {
  const disposed = vi.fn(async () => {})
  return { id, ...(child === undefined ? {} : { localAgent: child }), result: Promise.resolve({ output: [], stopReason: 'completed' }), dispose: disposed, disposed }
}

const user = (text: string, kind = 'user'): HostUserMessage => ({ id: 'message-' + text, role: 'user', content: [{ type: 'text', text }], source: { kind } })
const live = new AbortController().signal

describe('continuation turns for delegated children', () => {
  it('ends each tool continuation of the started child with a user turn, and only those', async () => {
    const h = host()
    const parent = agent('parent').value
    const child = agent('child')
    const started = await startWithContinuationTurns(h.value, parent, async () => {
      h.created(child.value, parent)
      return run('child', child.value)
    })
    expect(started.localAgent).toBe(child.value)
    expect(child.handlers).toHaveLength(1)
    const { handler, options } = child.handlers[0]!
    // Outermost, so the continuation lands after every other plugin's messages.
    expect(options).toEqual({ prepend: true })
    const prompt = user('Review the inherited completed checkpoint now.')
    await expect(handler({ step: 1, signal: live }, async () => ({ kind: 'enter', messages: [prompt] }))).resolves.toEqual({ kind: 'enter', messages: [prompt] })
    // A first step never gains one, even without user text.
    await expect(handler({ step: 1, signal: live }, async () => ({ kind: 'enter', messages: [] }))).resolves.toEqual({ kind: 'enter', messages: [] })
    const continued = await handler({ step: 2, signal: live }, async () => ({ kind: 'enter', messages: [] }))
    expect(continued).toMatchObject({ kind: 'enter', messages: [{ role: 'user', content: [{ type: 'text', text: CONTINUATION_TEXT }], source: { kind: 'dsh-mnemon', form: 'instructions' } }] })
    // A step that already ends in user text, such as a steer, needs nothing more.
    const steer = user('Also check the archive.')
    await expect(handler({ step: 3, signal: live }, async () => ({ kind: 'enter', messages: [steer] }))).resolves.toEqual({ kind: 'enter', messages: [steer] })
    // Blank text is no user query.
    const blank = user('  ', 'runtime-context')
    const padded = await handler({ step: 3, signal: live }, async () => ({ kind: 'enter', messages: [blank] }))
    expect(padded.kind === 'enter' && padded.messages.map(message => message.content)).toEqual([[{ type: 'text', text: '  ' }], [{ type: 'text', text: CONTINUATION_TEXT }]])
    await expect(handler({ step: 2, signal: live }, async () => ({ kind: 'reject' }))).resolves.toEqual({ kind: 'reject' })
    const aborted = AbortSignal.abort()
    await expect(handler({ step: 2, signal: aborted }, async () => ({ kind: 'enter', messages: [] }))).resolves.toEqual({ kind: 'enter', messages: [] })
  })

  it('attaches only to the child its own start creates under the parent', async () => {
    const h = host()
    const parent = agent('parent').value
    const child = agent('child')
    const other = agent('other')
    const late = agent('late')
    const started = await startWithContinuationTurns(h.value, parent, async () => {
      // Another parent's child published during this start is not ours.
      h.created(other.value, agent('someone-else').value)
      h.created(child.value, parent)
      return run('child', child.value)
    })
    expect(child.handlers).toHaveLength(1)
    expect(other.handlers).toHaveLength(0)
    // Observation ends with the start.
    expect(h.observers()).toBe(0)
    h.created(late.value, parent)
    expect(late.handlers).toHaveLength(0)
    await started.dispose()
    expect(child.stop).toHaveBeenCalledOnce()
  })

  it('separates overlapping starts by their async context', async () => {
    const h = host()
    const parent = agent('parent').value
    const first = agent('first')
    const second = agent('second')
    let publishSecond!: () => void
    const secondPublished = new Promise<void>(resolve => { publishSecond = resolve })
    const one = startWithContinuationTurns(h.value, parent, async () => {
      await secondPublished
      h.created(first.value, parent)
      return run('first', first.value)
    })
    const two = startWithContinuationTurns(h.value, parent, async () => {
      h.created(second.value, parent)
      publishSecond()
      return run('second', second.value)
    })
    await Promise.all([one, two])
    expect(first.handlers).toHaveLength(1)
    expect(second.handlers).toHaveLength(1)
  })

  it('releases what it attached when the start fails', async () => {
    const h = host()
    const parent = agent('parent').value
    const child = agent('child')
    await expect(startWithContinuationTurns(h.value, parent, async () => {
      h.created(child.value, parent)
      throw new Error('provider rolled back the child')
    })).rejects.toThrow('provider rolled back the child')
    expect(child.stop).toHaveBeenCalledOnce()
    expect(h.observers()).toBe(0)
  })

  it('leaves a child without pre-step support, or a host without creation events, as it was', async () => {
    const h = host()
    const parent = agent('parent').value
    const bare = { id: 'bare', ctx: {} } as unknown as HostAgent
    const started = await startWithContinuationTurns(h.value, parent, async () => {
      h.created(bare, parent)
      return run('bare', bare)
    })
    expect(started.id).toBe('bare')
    await started.dispose()
    const silent = { on: () => undefined }
    const plain = run('plain')
    const result = await startWithContinuationTurns(silent, parent, async () => plain)
    expect(result.id).toBe('plain')
    await result.dispose()
    expect(plain.disposed).toHaveBeenCalledOnce()
  })
})
