/**
 * Web issues found while writing the mobile handoff: autosave, AI refusals, library paging, starring, auto sync, copy
 * and the phone link. Stores run with Nuxt's auto-imports stubbed as globals; the phone link runs on the mock.
 */
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref, watch } from 'vue'
import ar from '~~/i18n/locales/ar.json'
import en from '~~/i18n/locales/en.json'
import { describeAiError } from '~/services/ai/errors'
import { createLinkHost, type LinkPlayer } from '~/services/link/host'
import { createLinkRemote, memoryPairingStore } from '~/services/link/remote'
import { createMockServices } from '~/services/mock'
import { memoryKV } from '~/services/mock/db'
import { createMockHub, memoryNetwork } from '~/services/mock/realtime'
import { SEED_PASSWORD } from '~/services/mock/seed'
import { PortError, type StudioState } from '~/services/types'
import { cleanMarks, diffEdit, shiftMarks } from '~/utils/marks'
import { copyTitle } from '~/utils/text'

const repo = { update: vi.fn() }
vi.mock('~/services/takes', () => ({ createIdbTakesRepo: () => repo }))

function stubNuxt(extra: Record<string, unknown>) {
  setActivePinia(createPinia())
  for (const [k, v] of Object.entries({ ref, computed, watch, ...extra })) vi.stubGlobal(k, v)
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('editor: a title with a trailing space', () => {
  it('saves once and stays saved', async () => {
    vi.useFakeTimers()
    const script = { id: 's1', title: 'Opening', body: 'one', marks: [], version: 1, readOnly: false }
    const update = vi.fn(async (_id: string, patch: { title?: string }) => ({ ...script, ...patch, version: script.version + 1 }))
    stubNuxt({
      useServices: () => ({ scripts: { get: async () => script, update } }),
      useScriptsStore: () => ({ upsert: () => {} }),
      useLimitError: () => ({ handle: () => false }),
      cleanMarks, diffEdit, shiftMarks,
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    })
    const { useEditorStore } = await import('~/stores/editor')
    const editor = useEditorStore()
    await editor.load('s1')
    update.mockClear()

    editor.setContent({ title: 'Opening night ' })
    await vi.advanceTimersByTimeAsync(60_000)

    expect(update).toHaveBeenCalledTimes(1)
    expect(editor.saveState).toBe('saved')
    expect(editor.dirty).toBe(false)
    expect(editor.title).toBe('Opening night ') // the field keeps what is being typed
    editor.reset()
  })
})

describe('editor: "save my edits as a new script"', () => {
  const wrap = (t: string) => `${t} (my edits)`
  it('keeps the new title within 120 characters', () => {
    const out = copyTitle('x'.repeat(120), wrap)
    expect(out).toHaveLength(120)
    expect(out.endsWith(' (my edits)')).toBe(true)
    expect(copyTitle('Short', wrap)).toBe('Short (my edits)')
  })
  it('never cuts a character in half', () => {
    const out = copyTitle('😀'.repeat(60), wrap)
    expect(out.length).toBeLessThanOrEqual(120)
    expect(out).toBe(`${'😀'.repeat(54)} (my edits)`)
  })
})

describe('AI format: a word-limit refusal', () => {
  it('is not reported as missing credits', () => {
    const e = new PortError('limit_reached', undefined, undefined, { key: 'scripts.max_words', value: 1000, usage: 1200 })
    expect(describeAiError(e)).toEqual({ kind: 'words_limit', params: { max: 1000, words: 1200 } })
    for (const messages of [en, ar]) {
      expect(messages.ai.errors).toHaveProperty('words_limit.title')
      expect((messages.ai.errors as unknown as Record<string, { text: string }>).words_limit!.text).toContain('{max}')
    }
  })
})

describe('library: a failed "Load more"', () => {
  it('keeps the error to show, and clears it on the next try', async () => {
    const row = (id: string) => ({ id, title: id, pinned: false, archivedAt: null })
    const page = vi.fn()
      .mockResolvedValueOnce({ data: [row('a')], nextCursor: 'c1', libraryCount: 2 })
      .mockResolvedValueOnce({ data: [], nextCursor: null, libraryCount: 2 }) // the last-opened card
      .mockRejectedValueOnce(new PortError('network'))
      .mockResolvedValueOnce({ data: [row('b')], nextCursor: null, libraryCount: 2 })
    stubNuxt({ useServices: () => ({ scripts: { page } }) })
    const { useScriptsStore } = await import('~/stores/scripts')
    const store = useScriptsStore()
    await store.load()

    await expect(store.loadMore()).resolves.toBeUndefined()
    expect(store.moreError).toBeInstanceOf(PortError)
    expect(store.hasMore).toBe(true)

    await store.loadMore()
    expect(store.moreError).toBeNull()
    expect(store.hasMore).toBe(false)
  })
})

describe('recordings: starring a take that is backed up', () => {
  const take = { id: 't1', starred: false, scriptId: 's1', createdAt: '2026-11-26T10:00:00Z', number: 1 }
  beforeEach(() => repo.update.mockReset())

  async function store(remoteInfo: unknown) {
    const update = vi.fn(async (id: string, patch: object) => ({ id, clientId: 't1', ...patch }))
    stubNuxt({ useServices: () => ({ remoteTakes: { update } }) })
    repo.update.mockResolvedValue({ ...take, starred: true, remote: remoteInfo })
    const { useTakesStore } = await import('~/stores/takes')
    const takes = useTakesStore()
    takes.list = [{ ...take, remote: remoteInfo }] as never
    return { takes, update }
  }

  it('updates the server record too', async () => {
    const { takes, update } = await store({ id: 'r1', state: 'backed_up' })
    await takes.setStarred('t1', true)
    expect(repo.update).toHaveBeenCalledWith('t1', { starred: true })
    expect(update).toHaveBeenCalledWith('r1', { starred: true })
  })

  it('leaves the server alone for a take that never left this browser', async () => {
    const { takes, update } = await store(undefined)
    await takes.setStarred('t1', true)
    expect(update).not.toHaveBeenCalled()
  })
})

describe('Drive: choosing Auto', () => {
  async function store() {
    const backfill = vi.fn(async () => 2)
    const setSyncMode = vi.fn(async () => {})
    stubNuxt({ useServices: () => ({ storage: { setSyncMode } }), useUploadsStore: () => ({ backfill }) })
    const { useStorageStore } = await import('~/stores/storage')
    const storage = useStorageStore()
    storage.status = { linked: true, syncMode: 'manual' } as never
    return { storage, backfill, setSyncMode }
  }

  it('queues the takes already on this device at once', async () => {
    const { storage, backfill } = await store()
    await storage.setSyncMode('auto')
    expect(backfill).toHaveBeenCalledTimes(1)
  })

  it('queues nothing for manual, or when the change is refused', async () => {
    const { storage, backfill, setSyncMode } = await store()
    await storage.setSyncMode('manual')
    setSyncMode.mockRejectedValueOnce(new PortError('limit_reached'))
    await expect(storage.setSyncMode('auto')).rejects.toBeInstanceOf(PortError)
    expect(backfill).not.toHaveBeenCalled()
  })
})

describe('copy that must match what happens', () => {
  it('the export is described as all scripts, not archived ones', () => {
    expect(`${en.settings.exportHint} ${en.settings.exportLede}`).not.toMatch(/archived scripts/i)
    expect(`${ar.settings.exportHint} ${ar.settings.exportLede}`).not.toContain('المؤرشفة')
  })
  it('the low-storage warning takes the plan length, not 10 minutes', () => {
    for (const messages of [en, ar]) {
      expect(messages.studio.lowStorage).toContain('{time}')
      expect(messages.studio.lowStorage).not.toContain('10')
    }
  })
  it('the studio help names Drive when backup is on', () => {
    expect(en.studio).toHaveProperty('helpNoteDrive')
    expect(ar.studio).toHaveProperty('helpNoteDrive')
  })
})

// ---------- phone link ----------
const noSleep = () => Promise.resolve()
const flush = async (n = 14) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 0)) }

async function linkSetup() {
  const kv = memoryKV()
  const net = memoryNetwork()
  const tab = () => createMockServices(kv, { origin: 'http://test', sleep: noSleep, hub: createMockHub({ bus: net.bus(), beatMs: 0 }) })
  const studio = tab()
  await studio.services.auth.signIn({ email: 'layan@example.com', password: SEED_PASSWORD })
  const scriptId = (await studio.services.scripts.list())[0]!.id
  let recording: NonNullable<StudioState['recording']>['state'] = 'unavailable'
  const takeOver = vi.fn()
  const player: LinkPlayer = {
    scriptId,
    apply: () => ({ result: 'applied' }),
    takeOver,
    snapshot: (): Omit<StudioState, 'seq'> => ({
      scriptTitle: 'T', paragraph: 0, paragraphCount: 3, playing: false, mode: 'constant', wpm: 120, fontSize: 'M',
      recording: { state: recording }, preview: { current: 'a', next: null },
    }),
  }
  const relay = studio.services.relay
  const answers = vi.spyOn(relay, 'answerRoles')
  const host = createLinkHost({ ...studio.services, coalesceMs: 0 })
  host.setPlayer(player)
  await host.open(scriptId)
  return { tab, host, takeOver, answers, setRecording: (s: typeof recording) => { recording = s } }
}

describe('remote: a second phone waiting for approval', () => {
  it('keeps waiting instead of ending on its own ping', async () => {
    const t = await linkSetup()
    const other = t.tab()
    const store = memoryPairingStore()
    const first = createLinkRemote({ relay: t.tab().services.relay, realtime: other.services.realtime, store: memoryPairingStore() })
    await first.pairWithCode(t.host.state.code!.code)
    await flush()
    await t.host.newCode()
    const second = createLinkRemote({ relay: other.services.relay, realtime: other.services.realtime, store })
    await second.pairWithCode(t.host.state.code!.code)
    await flush()
    await second.wake()
    expect(second.state.phase).toBe('waitingAccept')

    // A reload while waiting keeps waiting too.
    const reloaded = createLinkRemote({ relay: other.services.relay, realtime: other.services.realtime, store })
    await reloaded.start()
    await flush()
    expect(reloaded.state.phase).toBe('waitingAccept')
    first.dispose()
    second.dispose()
    reloaded.dispose()
  })
})

describe('phone link: swapping who reads', () => {
  async function withApp() {
    const t = await linkSetup()
    const app = await t.tab().knobs.pairMockApp(t.host.state.code!.code)
    await flush()
    return { ...t, app }
  }

  it.each(['countdown', 'recording', 'saving'] as const)('declines with "recording" during %s', async (state) => {
    const t = await withApp()
    t.setRecording(state)
    await t.app.askToRead()
    await flush()
    expect(t.answers).toHaveBeenCalledWith(expect.anything(), expect.any(String), false, 'recording')
    expect(t.host.state.roleRequest).toBeNull()
    expect(t.host.state.link?.player).toBe('host')
    t.app.stop()
  })

  it('declines a waiting request once a take starts', async () => {
    const t = await withApp()
    await t.app.askToRead()
    await flush()
    expect(t.host.state.roleRequest).not.toBeNull()
    t.setRecording('countdown')
    t.host.changed()
    await flush()
    expect(t.answers).toHaveBeenCalledWith(expect.anything(), expect.any(String), false, 'recording')
    expect(t.host.state.roleRequest).toBeNull()
    t.app.stop()
  })

  it('takes over the app\'s position when reading comes back', async () => {
    const t = await withApp()
    await t.host.requestRoles('remote')
    await flush()
    await t.host.send('next')
    await flush()
    expect(t.host.state.appState?.paragraph).toBe(1)
    await t.host.requestRoles('host')
    await flush()
    expect(t.takeOver).toHaveBeenCalledWith(1)
    t.app.stop()
  })
})
