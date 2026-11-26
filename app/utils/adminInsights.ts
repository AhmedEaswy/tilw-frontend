/**
 * Feature 007 helpers for the analytics page and the user tabs: provider ids as the API names them → brand marks,
 * durations, shares.
 */
import type { ProviderId } from '~/components/brand/ProviderMark.vue'

const MARKS: Record<string, ProviderId> = { anthropic: 'anthropic', openai: 'openai', minimax: 'minimax', deepseek: 'deepseek', deepgram: 'deepgram', google_drive: 'google-drive' }
/** `google_drive` → `google-drive`; unknown providers have no mark. */
export const providerMark = (p: string | null | undefined): ProviderId | undefined => (p ? MARKS[p] : undefined)
const NAMES: Record<string, string> = { anthropic: 'Anthropic', openai: 'OpenAI', minimax: 'MiniMax', deepseek: 'DeepSeek', deepgram: 'Deepgram', google_drive: 'Google Drive' }
/** Product names as each company writes them; anything else as sent. */
export const providerName = (p: string) => NAMES[p] ?? p

/** Seconds → "4:05" or "1:02:05"; null → "—". */
export function clockTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—'
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`
}

/** 0.347 → "35%"; null → "—". */
export const percent = (share: number | null | undefined) => (share === null || share === undefined ? '—' : `${Math.round(share * 100)}%`)

/** One decimal, grouped: 1234.5 → "1,234.5". */
export const decimal = (n: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(n)
