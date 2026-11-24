import { describe, expect, it } from 'vitest'
import { freeBytes, levelFromSamples, levelSegments, mustStop, QUOTA_SAFETY, RECORD_LIMIT_MS, recordLimitMs, takeFileName, waveBars } from '~/utils/media'
import { pickRecorderMime } from '~/utils/mime'
import { createMemoryTakesRepo, type Take } from '~/services/takes'

// US6 — recording limits, meter and the device-only takes repository.

describe('recording limits', () => {
  it('stops at 10 minutes', () => {
    expect(mustStop(RECORD_LIMIT_MS - 1, 0, null)).toBeNull()
    expect(mustStop(RECORD_LIMIT_MS, 0, null)).toBe('limit')
  })

  // Release 2 (T012): the cap comes from the plan's takes.max_minutes.
  it('uses the plan value, and 10 minutes when the plan is unknown', () => {
    expect(recordLimitMs(60)).toBe(60 * 60_000)
    expect(recordLimitMs(1)).toBe(60_000)
    expect(recordLimitMs(undefined)).toBe(RECORD_LIMIT_MS)
    expect(recordLimitMs(0)).toBe(RECORD_LIMIT_MS)
    expect(recordLimitMs('10')).toBe(RECORD_LIMIT_MS)
    expect(recordLimitMs(null)).toBe(Number.POSITIVE_INFINITY) // unlimited plan: only storage stops it
    expect(mustStop(59_999, 0, null, recordLimitMs(1))).toBeNull()
    expect(mustStop(60_000, 0, null, recordLimitMs(1))).toBe('limit')
    expect(mustStop(30 * 60_000, 0, null, recordLimitMs(60))).toBeNull()
    expect(mustStop(30 * 60_000, 0, null, recordLimitMs(null))).toBeNull()
  })

  it('stops before browser storage runs out', () => {
    const free = 100_000_000
    expect(mustStop(5_000, free * QUOTA_SAFETY - 1, free)).toBeNull()
    expect(mustStop(5_000, free * QUOTA_SAFETY, free)).toBe('quota')
    expect(mustStop(5_000, 9e12, null)).toBeNull() // browser doesn't report a quota
  })

  it('reads free space from a storage estimate', () => {
    expect(freeBytes({ quota: 1000, usage: 250 })).toBe(750)
    expect(freeBytes({ usage: 5 })).toBeNull()
    expect(freeBytes(null)).toBeNull()
  })
})

describe('level meter', () => {
  it('is silent for a flat signal and rises with amplitude', () => {
    const silent = new Uint8Array(512).fill(128)
    const loud = Uint8Array.from({ length: 512 }, (_, i) => (i % 2 ? 200 : 56))
    expect(levelFromSamples(silent)).toBe(0)
    expect(levelFromSamples(loud)).toBeGreaterThan(0.8)
    expect(levelFromSamples(loud)).toBeLessThanOrEqual(1)
  })

  it('lights segments with the top two in the cue colour', () => {
    expect(levelSegments(0, 5)).toEqual(['off', 'off', 'off', 'off', 'off'])
    expect(levelSegments(0.6, 5)).toEqual(['lo', 'hi', 'hi', 'off', 'off'])
    expect(levelSegments(2, 5)).toEqual(['lo', 'lo', 'lo', 'hi', 'hi'])
  })
})

describe('file names and containers', () => {
  it('names a downloaded original after the script and take', () => {
    expect(takeFileName('افتتاحية الحلقة', 2, 'video/webm;codecs=vp9,opus', 'المحاولة')).toBe('افتتاحية الحلقة - المحاولة 2.webm')
    expect(takeFileName('a/b: c?', 1, 'audio/mp4', 'take')).toBe('a b c - take 1.m4a')
  })

  it('reports no container when MediaRecorder is missing', () => {
    expect(pickRecorderMime('video')).toBe('')
  })
})

describe('takes repository', () => {
  const take = (id: string, at: string, size = 3): Take => ({
    id,
    scriptId: 's_opening',
    scriptTitle: 'افتتاحية الحلقة',
    number: 1,
    kind: 'audio',
    mimeType: 'audio/webm',
    durationMs: 4200,
    sizeBytes: size,
    starred: false,
    createdAt: at,
    blob: new Blob(['abc'], { type: 'audio/webm' }),
  })

  it('lists metadata newest first without loading blobs', async () => {
    const repo = createMemoryTakesRepo()
    await repo.put(take('t1', '2026-11-19T10:00:00Z'))
    await repo.put(take('t2', '2026-11-19T11:00:00Z'))
    const list = await repo.list()
    expect(list.map(t => t.id)).toEqual(['t2', 't1'])
    expect(list[0]).not.toHaveProperty('blob')
  })

  it('returns the original file and removes both parts', async () => {
    const repo = createMemoryTakesRepo()
    await repo.put(take('t1', '2026-11-19T10:00:00Z'))
    const got = await repo.get('t1')
    expect(await got!.blob.text()).toBe('abc')
    expect(got!.mimeType).toBe('audio/webm')
    await repo.remove('t1')
    expect(await repo.get('t1')).toBeNull()
    expect(await repo.list()).toEqual([])
  })

  it('stars a take', async () => {
    const repo = createMemoryTakesRepo()
    await repo.put(take('t1', '2026-11-19T10:00:00Z'))
    expect((await repo.update('t1', { starred: true })).starred).toBe(true)
    expect((await repo.list())[0]!.starred).toBe(true)
  })
})

describe('take waveform picture', () => {
  it('is stable per take and stays in range', () => {
    const a = waveBars('t_one', 32)
    expect(a).toHaveLength(32)
    expect(waveBars('t_one', 32)).toEqual(a)
    expect(waveBars('t_two', 32)).not.toEqual(a)
    expect(a.every(h => h >= 0.2 && h <= 1)).toBe(true)
  })
})
