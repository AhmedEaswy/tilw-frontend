import { describe, expect, it } from 'vitest'
import { createMockServices } from '~/services/mock'
import { memoryKV } from '~/services/mock/db'
import { memoryBlobStore } from '~/services/mock/drive'
import { SEED_PASSWORD } from '~/services/mock/seed'
import { isPortError } from '~/services/types'

// PR #5 review fixes: video only for captions in the mock.

// Dictation moved to the device (G-A5): see dictation.test.ts.

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
