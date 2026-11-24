/**
 * Feature 004 (research R6, R7): what a phone command does on a reading page. It calls the same engine functions and
 * settings steps as the page's own buttons and shortcuts, so a press on the phone behaves like a press in the studio.
 * Commands are never queued: anything that can't happen now is refused with one of the contract's reasons.
 */
import type { LinkCommand, ReadingSettings, RefusalReason, StudioState } from '~/services/types'
import { LINK_RULES } from '~/services/types'
import { FONT_STEPS, WPM_STEP, clampWpm } from './reader'

export type Answer = { result: 'applied' } | { result: 'refused'; reason: RefusalReason }
const applied: Answer = { result: 'applied' }
const refuse = (reason: RefusalReason): Answer => ({ result: 'refused', reason })

/** The slice of the reader engine a command needs. */
export interface ReadingEngine {
  playing: { value: boolean }
  countdown: { value: number }
  ended: { value: boolean }
  paragraph: { value: number }
  total: { value: number }
  play(o?: { countdown?: boolean }): void
  stop(): void
  next(): void
  prev(): void
  goTo(i: number): void
  restart(): void
}

export interface ReadingContext {
  engine: ReadingEngine
  settings: ReadingSettings
  update(patch: Partial<ReadingSettings>): void
  /** The script is loaded and has text. */
  ready: boolean
  /** Something sits over the reader (recovery screen, a dialog): commands wait for the person. */
  blocked: boolean
}

/** Reading commands (everything but record start/stop, which only the recording studio handles). */
export function applyReadingCommand(cmd: LinkCommand, c: ReadingContext): Answer {
  if (!c.ready || c.blocked || c.engine.countdown.value > 0) return refuse('unsupported')
  const e = c.engine
  switch (cmd.type) {
    case 'play':
      if (c.settings.mode !== 'constant') return refuse('unsupported')
      if (!e.playing.value) e.play()
      return applied
    case 'pause':
      if (e.playing.value) e.stop()
      return applied
    case 'next':
      if (e.ended.value || e.paragraph.value >= e.total.value - 1) return refuse('at_end')
      e.next()
      return applied
    case 'previous':
      if (!e.ended.value && e.paragraph.value <= 0) return refuse('at_start')
      e.prev()
      return applied
    case 'goto': {
      const n = cmd.paragraph ?? -1
      if (!Number.isInteger(n) || n < 0 || n >= e.total.value) return refuse('unsupported')
      e.goTo(n)
      return applied
    }
    case 'restart':
      e.restart()
      return applied
    case 'faster':
    case 'slower': {
      if (c.settings.mode !== 'constant') return refuse('unsupported')
      c.update({ wpm: clampWpm(c.settings.wpm + (cmd.type === 'faster' ? WPM_STEP : -WPM_STEP)) })
      return applied
    }
    case 'speed':
      if (typeof cmd.wpm !== 'number') return refuse('unsupported')
      c.update({ wpm: clampWpm(cmd.wpm) })
      return applied
    case 'textBigger':
    case 'textSmaller': {
      const i = FONT_STEPS.indexOf(c.settings.fontSize)
      const j = Math.min(FONT_STEPS.length - 1, Math.max(0, i + (cmd.type === 'textBigger' ? 1 : -1)))
      if (j !== i) c.update({ fontSize: FONT_STEPS[j]! })
      return applied
    }
    case 'recordStart':
    case 'recordStop':
      return refuse('not_recording_mode')
    default:
      return refuse('unsupported')
  }
}

const cut = (s: string | undefined | null) => (s ? s.slice(0, LINK_RULES.previewChars) : '')

/** What the phone shows; previews are added here and removed by the store (and the server) when they're off. */
export function readingSnapshot(o: {
  title: string | null | undefined
  paragraphs: readonly string[]
  engine: Pick<ReadingEngine, 'paragraph' | 'playing'>
  settings: ReadingSettings
  recording?: StudioState['recording']
}): Omit<StudioState, 'seq'> {
  const i = Math.min(o.engine.paragraph.value, Math.max(0, o.paragraphs.length - 1))
  return {
    scriptTitle: o.title ? o.title.slice(0, 120) : null,
    paragraph: i,
    paragraphCount: o.paragraphs.length,
    playing: o.engine.playing.value,
    mode: o.settings.mode,
    wpm: o.settings.wpm,
    fontSize: o.settings.fontSize,
    recording: o.recording ?? { state: 'unavailable' },
    preview: { current: cut(o.paragraphs[i]), next: o.paragraphs[i + 1] ? cut(o.paragraphs[i + 1]) : null },
  }
}

/** The recording studio's phases as the phone sees them. */
export type StudioPhase = 'setup' | 'countdown' | 'recording'

export interface RecordContext {
  phase: StudioPhase
  /** Camera and/or microphone are on (the preview is live). */
  devicesOn: boolean
  /** A finished take is being written. */
  saving: boolean
  /** The script is loaded and has text. */
  ready: boolean
  /** The page's own Start (countdown, then the take). */
  start(): void
  /** The page's own Stop: ends and saves the take. */
  stop(): void
  /** The page's own Cancel during the countdown. */
  cancelCountdown(): void
}

/**
 * Feature 004 US3 (T037): Record and Stop from the phone go through the recording studio's own Start / Stop, so a
 * take started from the phone is the same as one started here. Only `recordStop` ever stops a take (SC-005).
 */
export function applyRecordCommand(cmd: LinkCommand, c: RecordContext): Answer {
  if (cmd.type === 'recordStart') {
    if (c.saving) return refuse('saving')
    if (c.phase !== 'setup') return refuse('already_recording')
    if (!c.devicesOn) return refuse('devices_off')
    if (!c.ready) return refuse('unsupported')
    c.start()
    return applied
  }
  if (cmd.type === 'recordStop') {
    if (c.saving) return refuse('saving')
    // Stop during the countdown cancels it, as Esc does in the studio: nothing has been recorded yet.
    if (c.phase === 'countdown') { c.cancelCountdown(); return applied }
    if (c.phase !== 'recording') return refuse('not_recording')
    c.stop()
    return applied
  }
  return refuse('unsupported')
}

/** What the phone shows about recording (Figma L5 recording `286:424`). */
export function recordingState(o: {
  phase: StudioPhase
  devicesOn: boolean
  saving: boolean
  saved: boolean
  failed: boolean
  startedAt: string | null
}): StudioState['recording'] {
  if (o.saving) return { state: 'saving' }
  if (o.phase === 'countdown') return { state: 'countdown' }
  if (o.phase === 'recording') return o.startedAt ? { state: 'recording', startedAt: o.startedAt } : { state: 'recording' }
  if (o.failed) return { state: 'failed' }
  if (o.saved) return { state: 'saved' }
  return { state: o.devicesOn ? 'idle' : 'unavailable' }
}
