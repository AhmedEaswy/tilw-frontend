/**
 * Feature 005: reads a Deepgram pre-recorded answer (backend device-flows §1, §2). Pure, unit-tested.
 * Text: `results.channels[0].alternatives[0].paragraphs.transcript`, falling back to `…alternatives[0].transcript`.
 * Words for captions: `results.utterances[].words[]` (utterance boundaries kept), else the alternative's words.
 */
import type { SpeechResult, SpeechWord } from '../types'

interface DgWord { word?: string; punctuated_word?: string; start?: number; end?: number }
interface DgAnswer {
  metadata?: { request_id?: string; duration?: number }
  results?: {
    channels?: { detected_language?: string; alternatives?: { transcript?: string; paragraphs?: { transcript?: string }; words?: DgWord[] }[] }[]
    utterances?: { words?: DgWord[] }[]
  }
}

const toWord = (w: DgWord): SpeechWord | null => {
  const text = (w.punctuated_word ?? w.word ?? '').trim()
  if (!text || typeof w.start !== 'number' || typeof w.end !== 'number') return null
  return { word: text, start: w.start, end: Math.max(w.start, w.end) }
}

/** Paragraph breaks kept, other whitespace tidied. */
export function tidyTranscript(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
}

export function parseDeepgram(raw: unknown): SpeechResult {
  const a = (raw ?? {}) as DgAnswer
  const channel = a.results?.channels?.[0]
  const alt = channel?.alternatives?.[0]
  const transcript = tidyTranscript(alt?.paragraphs?.transcript ?? alt?.transcript ?? '')
  const words: SpeechWord[] = []
  const utteranceBreaks: number[] = []
  if (a.results?.utterances?.length) {
    for (const u of a.results.utterances) {
      const list = (u.words ?? []).map(toWord).filter((w): w is SpeechWord => !!w)
      if (!list.length) continue
      if (words.length) utteranceBreaks.push(words.length)
      words.push(...list)
    }
  } else {
    words.push(...(alt?.words ?? []).map(toWord).filter((w): w is SpeechWord => !!w))
  }
  return {
    requestId: a.metadata?.request_id ?? '',
    transcript,
    language: channel?.detected_language ?? null,
    duration: typeof a.metadata?.duration === 'number' ? a.metadata.duration : null,
    words,
    utteranceBreaks,
  }
}
