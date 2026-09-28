import type { Context } from '@deepseek-ai/cordis'
import { prepareStarterResolution } from './starter-resolution.ts'

export const name = 'dsh-mnemon-starter'
export const provide = ['mnemonStarterReady']

/** Prepare the Starter before its native group imports independent components. */
export async function apply(ctx: Context): Promise<void> {
  await prepareStarterResolution(ctx)
  ctx.provide('mnemonStarterReady', true)
}
