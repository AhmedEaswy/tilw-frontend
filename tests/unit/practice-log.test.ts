import { afterEach, describe, expect, it, vi } from 'vitest'
import { logPractice, PRACTICE_MIN_S } from '~/composables/usePracticeLog'

// Feature 007: a finished run is reported in the background; short runs are skipped and failures never surface.

describe('logPractice', () => {
  const g = globalThis as unknown as { useServices?: () => unknown }
  afterEach(() => delete g.useServices)
  function stub(impl: (input: unknown) => Promise<unknown>) {
    const log = vi.fn(impl)
    g.useServices = () => ({ practice: { log } })
    return log
  }

  it('reports whole seconds, capped at 6 hours', () => {
    const log = stub(async () => ({}))
    logPractice({ scriptId: 's1', startedAt: '2026-11-25T10:00:00.000Z', durationMs: 42_400, recorded: true, via: 'web' })
    expect(log).toHaveBeenCalledWith({ scriptId: 's1', startedAt: '2026-11-25T10:00:00.000Z', durationS: 42, recorded: true, via: 'web' })
    logPractice({ scriptId: null, startedAt: '2026-11-25T10:00:00.000Z', durationMs: 8 * 3_600_000, recorded: false, via: 'phone' })
    expect(log.mock.calls[1]![0]).toMatchObject({ durationS: 21_600, via: 'phone' })
  })

  it('skips runs under 10 seconds', () => {
    const log = stub(async () => ({}))
    logPractice({ scriptId: 's1', startedAt: '2026-11-25T10:00:00.000Z', durationMs: (PRACTICE_MIN_S - 0.6) * 1000, recorded: false, via: 'web' })
    expect(log).not.toHaveBeenCalled()
  })

  it('swallows a failure', async () => {
    const log = stub(async () => {
      throw new Error('network')
    })
    expect(() => logPractice({ scriptId: 's1', startedAt: '2026-11-25T10:00:00.000Z', durationMs: 30_000, recorded: false, via: 'web' })).not.toThrow()
    await Promise.resolve()
    expect(log).toHaveBeenCalledTimes(1)
  })
})
