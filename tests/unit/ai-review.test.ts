import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref, shallowRef } from 'vue'
import { createMockServices } from '~/services/mock'
import { memoryKV } from '~/services/mock/db'
import { memoryBlobStore } from '~/services/mock/drive'
import { SEED_PASSWORD } from '~/services/mock/seed'
import { isPortError } from '~/services/types'

// PR #5 review fixes: dictation cancelled during the permission prompt, and video only for captions in the mock.

describe('useDictation', () => {
  let resolvePrompt: (ok: boolean) => void
  const devices = {
    state: ref('idle'),
    stream: shallowRef<MediaStream | null>(null),
    start: vi.fn(() => new Promise<boolean>((r) => {
      resolvePrompt = (ok) => {
        if (ok) devices.stream.value = {} as MediaStream
        r(ok)
      }
    })),
    stop: vi.fn(() => (devices.stream.value = null)),
  }
  const recorder = { recording: ref(false), elapsedMs: ref(0), start: vi.fn(async () => true), stop: vi.fn(async () => null) }

  beforeEach(() => {
    vi.clearAllMocks()
    devices.stream.value = null
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('onBeforeUnmount', () => {})
    vi.stubGlobal('useMediaDevices', () => devices)
    vi.stubGlobal('useRecorder', () => recorder)
    vi.stubGlobal('useLevelMeter', () => ({ level: ref(0) }))
  })

  it('never starts recording when cancelled while the permission prompt is up, and stops the tracks', async () => {
    const { useDictation } = await import('~/composables/useDictation')
    const d = useDictation({ maxMinutes: () => 60 })
    const started = d.start()
    d.cancel()
    resolvePrompt(true)
    expect(await started).toBe(false)
    expect(recorder.start).not.toHaveBeenCalled()
    expect(devices.stream.value).toBeNull()
    expect(devices.stop).toHaveBeenCalled()
  })

  it('records when not cancelled', async () => {
    const { useDictation } = await import('~/composables/useDictation')
    const d = useDictation({ maxMinutes: () => 60 })
    const started = d.start()
    resolvePrompt(true)
    expect(await started).toBe(true)
    expect(recorder.start).toHaveBeenCalledWith(expect.anything(), 'audio', null, 3_600_000)
  })
})

describe('mock audio types', () => {
  it('refuses video for text and accepts it for captions', async () => {
    const m = createMockServices(memoryKV(), { origin: 'http://test', sleep: () => Promise.resolve(), blobs: memoryBlobStore() })
    await m.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })
    const e = await m.services.ai.transcriptionEstimate({ seconds: 10, bytes: 10, mimeType: 'video/webm' }).catch(x => x)
    expect(isPortError(e, 'validation')).toBe(true)
    expect((await m.services.ai.transcriptionEstimate({ seconds: 10, bytes: 10, mimeType: 'video/webm', purpose: 'captions' })).credits).toBe(1)
    expect((await m.services.ai.startTranscription({ seconds: 10, bytes: 10, mimeType: 'video/webm', purpose: 'captions' })).purpose).toBe('captions')
  })
})
