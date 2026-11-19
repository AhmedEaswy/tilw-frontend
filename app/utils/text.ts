/** Text helpers for scripts: words, paragraphs, duration, direction. Auto-imported by Nuxt. */

export function splitParagraphs(body: string): string[] {
  return body
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
}

export function countWords(text: string): number {
  const m = text.trim().match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}'’-]*/gu)
  return m ? m.length : 0
}

/** Whole minutes at the given pace, never less than 1 for non-empty text. */
export function estimateMinutes(words: number, wpm: number): number {
  if (words <= 0) return 0
  return Math.max(1, Math.round(words / Math.max(1, wpm)))
}

export function firstLine(body: string, max = 80): string {
  const line = body.trim().split(/\n/)[0] ?? ''
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

/** Direction of the first strong character; used when a script's direction is 'auto'. */
export function detectDirection(text: string): 'rtl' | 'ltr' {
  const m = text.match(/[\p{Script=Arabic}\p{Script=Hebrew}]|[A-Za-zÀ-ɏ]/u)
  return m && /[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(m[0]) ? 'rtl' : 'ltr'
}

/** Title from a file name: strip extension, underscores and dashes. */
export function titleFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || name
}

/**
 * Normalise text for search: lower-case, strip Arabic diacritics and tatweel, unify alef/yeh/teh-marbuta
 * forms, so "الحلقه" finds "الحلقة" and "اول" finds "أوّل".
 */
export function foldForSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[ً-ٰٟـ̀-ͯ]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
}

export const normalizeEmail = (e: string) => e.trim().toLowerCase()
export const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim())
export const PASSWORD_MIN = 8
