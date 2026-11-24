/**
 * Feature 004, US4 (T014, deferred here): a stand-in for the Tilw mobile app paired as a link's remote, for the mock
 * only (/__mock and e2e). It answers the studio's role requests with yes, and once it reads (`player === 'remote'`)
 * it applies commands to a three-paragraph script, answers them and sends its state, as the real app would.
 */
import type { LinkRelayPort, RealtimeConnection, RealtimePort } from '../ports'
import type { LinkAuth, LinkCommand, LinkParty, Pairing, RefusalReason, StudioState } from '../types'

export interface MockAppState {
  paired: boolean
  /** Who reads: `remote` means this app. */
  player: LinkParty
  paragraph: number
  playing: boolean
  wpm: number
}

export function startMockApp(o: { relay: LinkRelayPort; realtime: RealtimePort; pairing: Pairing; total?: number }) {
  const total = o.total ?? 3
  const linkId = o.pairing.link.id
  const auth: LinkAuth = { kind: 'remote', credential: o.pairing.credential! }
  const st: MockAppState = { paired: true, player: o.pairing.link.player, paragraph: 0, playing: false, wpm: 120 }
  const cbs = new Set<(s: MockAppState) => void>()
  const emit = () => cbs.forEach(cb => cb({ ...st }))
  let seq = 0
  let conn: RealtimeConnection | null = null

  function sendState() {
    if (st.player !== 'remote') return
    const state: StudioState = {
      seq: (seq = Math.max(seq + 1, Date.now())),
      scriptTitle: 'Tilw app (mock)', paragraph: st.paragraph, paragraphCount: total, playing: st.playing, mode: 'constant',
      wpm: st.wpm, fontSize: 'M', recording: { state: 'unavailable' },
      preview: { current: `Paragraph ${st.paragraph + 1}`, next: st.paragraph + 1 < total ? `Paragraph ${st.paragraph + 2}` : null },
    }
    void o.relay.state(auth, linkId, state).catch(() => {})
  }

  function apply(cmd: LinkCommand): { result: 'applied' } | { result: 'refused'; reason: RefusalReason } {
    switch (cmd.type) {
      case 'next':
        if (st.paragraph >= total - 1) return { result: 'refused', reason: 'at_end' }
        st.paragraph++
        break
      case 'previous':
        if (st.paragraph <= 0) return { result: 'refused', reason: 'at_start' }
        st.paragraph--
        break
      case 'restart': st.paragraph = 0; break
      case 'play': st.playing = true; break
      case 'pause': st.playing = false; break
      case 'faster': st.wpm = Math.min(220, st.wpm + 10); break
      case 'slower': st.wpm = Math.max(60, st.wpm - 10); break
      default: return { result: 'refused', reason: 'unsupported' }
    }
    return { result: 'applied' }
  }

  conn = o.realtime.connect(auth, o.pairing.realtime)
  void conn.subscribe(o.pairing.channels.own, (e) => {
    if (e.name === 'roles.requested') void o.relay.answerRoles(auth, linkId, true).catch(() => {})
    if (e.name === 'roles.changed') {
      st.player = e.data.player
      emit()
      sendState()
    }
    if (e.name === 'command' && st.player === 'remote') {
      const answer = apply(e.data)
      void o.relay.ack(auth, linkId, { commandId: e.data.id, ...answer }).catch(() => {})
      emit()
      sendState()
    }
    if (e.name === 'link.ended' || e.name === 'remote.replaced') {
      st.paired = false
      emit()
      conn?.close()
    }
  }).then(() => conn?.presence(o.pairing.channels.presence, { members: () => {}, added: () => {}, removed: () => {} }))

  return {
    get state(): Readonly<MockAppState> { return st },
    subscribe(cb: (s: MockAppState) => void) {
      cbs.add(cb)
      cb({ ...st })
      return () => { cbs.delete(cb) }
    },
    /** The app asks to read (the studio sees the request popover). */
    askToRead: () => o.relay.requestRoles(auth, linkId, 'remote'),
    stop() {
      conn?.close()
      conn = null
      st.paired = false
      emit()
    },
  }
}

export type MockApp = ReturnType<typeof startMockApp>
