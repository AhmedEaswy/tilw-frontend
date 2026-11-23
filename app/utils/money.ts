/**
 * Release 2 formatting: prices are US cents shown with "$" and Western digits in both languages (spec edge case),
 * dates use the interface language with Latin digits, as the rest of the app does.
 */
export function formatPrice(cents: number): string {
  const whole = cents % 100 === 0
  return `$${(cents / 100).toFixed(whole ? 0 : 2)}`
}

/** Yearly saving against twelve monthly payments, in whole percent (0 when none). */
export function yearlySaving(monthlyCents: number, yearlyCents: number): number {
  const full = monthlyCents * 12
  if (full <= 0 || yearlyCents >= full) return 0
  return Math.round(((full - yearlyCents) / full) * 100)
}

export function formatDay(iso: string | number, locale: string): string {
  const tag = locale === 'ar' ? 'ar-u-nu-latn' : 'en'
  return new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
}

/** "2.4 GB" / "830 MB" with Latin digits. */
export function formatBytes(n: number, locale: string): string {
  const units = locale === 'ar' ? ['بايت', 'ك.ب', 'م.ب', 'ج.ب', 'ت.ب'] : ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  const num = new Intl.NumberFormat('en', { maximumFractionDigits: v < 10 && i > 0 ? 1 : 0 }).format(v)
  return `${num} ${units[i]}`
}
