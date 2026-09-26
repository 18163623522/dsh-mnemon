import type { HostSession, HostSessionEvent } from '../../src/host/dsh.ts'

/** DSH Session log readers over a live event array; later pushes stay visible. */
export function sessionLog(events: HostSessionEvent[] = []): Pick<HostSession, 'snapshotEvents' | 'eventAt'> {
  return {
    snapshotEvents: (fromSeq = 0, toSeqExclusive = events.length) => events.slice(fromSeq, toSeqExclusive),
    eventAt: seq => events[seq],
  }
}
