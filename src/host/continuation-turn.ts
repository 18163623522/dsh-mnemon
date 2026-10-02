import { AsyncLocalStorage } from 'node:async_hooks'
import type { HostAgent, HostPreStepDecision, HostSubagentRun, HostUserMessage } from './dsh.ts'
import { createPluginMessage } from './plugin-message.ts'

/** The user turn that ends a delegated child's tool continuation. */
export const CONTINUATION_TEXT = 'Continue from the tool results above.'

export interface ContinuationHost {
  agents?: { isOwnedBy?(id: string, parent: HostAgent): boolean }
  on(name: string, listener: (...args: never[]) => unknown): unknown
}

interface PreStepPayload {
  step: number
  signal: AbortSignal
}

// Distinguishes overlapping starts, as review-tools.ts does for its guard.
const startingChild = new AsyncLocalStorage<symbol>()

function hasUserText(message: HostUserMessage): boolean {
  return message.role === 'user' && message.content.some(block => block.type === 'text' && typeof block.text === 'string' && block.text.trim() !== '')
}

/**
 * Some chat templates refuse a request without a user query: Ollama 0.33
 * serving Qwen3.x answers 500 "no user query found in messages" (#327). A
 * delegated child's only user turn is its prompt. Once tool results fill the
 * model's context window, Ollama truncates from the front and drops that
 * prompt while keeping the tool messages after it. The server always keeps the
 * last message, so each tool continuation ends with a short user turn. The
 * first step carries the prompt, and a step that brings its own user text
 * needs nothing more.
 */
function endContinuationsWithUserTurn(agent: HostAgent): (() => unknown) | undefined {
  if (typeof agent.ctx?.on !== 'function') return undefined
  return agent.ctx.on('agent/pre-step', (async (payload: PreStepPayload, next: () => Promise<HostPreStepDecision>) => {
    const decision = await next()
    if (payload.step === 1 || payload.signal.aborted || decision.kind !== 'enter' || decision.messages.some(hasUserText)) return decision
    return { kind: 'enter', messages: [...decision.messages, createPluginMessage(CONTINUATION_TEXT, 'instructions')] }
  }) as never, { prepend: true })
}

/**
 * Start one delegated child and attach the continuation turn while DSH
 * publishes it, before its first step. Async context attributes concurrent
 * starts, and DSH's ownership check confirms the parent where it exists. A host
 * that does not report creation leaves the child as it was.
 */
export async function startWithContinuationTurns(host: ContinuationHost, parent: HostAgent, start: () => Promise<HostSubagentRun>): Promise<HostSubagentRun> {
  const pending = Symbol('Mnemon delegated start')
  const stops: Array<() => unknown> = []
  const listener = host.on('agent/created', (({ agent }: { agent: HostAgent }) => {
    if (startingChild.getStore() !== pending) return
    if (typeof host.agents?.isOwnedBy === 'function' && !host.agents.isOwnedBy(agent.id, parent)) return
    const stop = endContinuationsWithUserTurn(agent)
    if (typeof stop === 'function') stops.push(stop)
  }) as never)
  const release = async () => { for (const stop of stops.splice(0)) await stop() }
  let run: HostSubagentRun
  try {
    run = await startingChild.run(pending, start)
  } catch (error) {
    await release()
    throw error
  } finally {
    if (typeof listener === 'function') await listener()
  }
  const active = run
  return { id: active.id, ...(active.localAgent === undefined ? {} : { localAgent: active.localAgent }), result: active.result, async dispose() {
    try { await active.dispose() } finally { await release() }
  } }
}
