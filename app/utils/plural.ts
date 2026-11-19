/**
 * Count words with the right noun form. Arabic has one / two / few (3–10) / many (11+) forms,
 * which vue-i18n's default plural rule doesn't cover.
 */
type Forms = { ar: [one: string, two: string, few: string, many: string]; en: [one: string, other: string] }

export const UNITS = {
  minute: { ar: ['دقيقة', 'دقيقتان', 'دقائق', 'دقيقة'], en: ['minute', 'minutes'] },
  word: { ar: ['كلمة', 'كلمتان', 'كلمات', 'كلمة'], en: ['word', 'words'] },
  paragraph: { ar: ['فقرة', 'فقرتان', 'فقرات', 'فقرة'], en: ['paragraph', 'paragraphs'] },
} satisfies Record<string, Forms>

export function unitFor(n: number, unit: keyof typeof UNITS, locale: string): string {
  const f = UNITS[unit]
  if (locale !== 'ar') return n === 1 ? f.en[0] : f.en[1]
  const k = Math.abs(n) % 100
  if (n === 1) return f.ar[0]
  if (n === 2) return f.ar[1]
  if (k >= 3 && k <= 10) return f.ar[2]
  return f.ar[3]
}
