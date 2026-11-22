/** "3 days ago", "yesterday", "in 4 days" in the interface language, with Latin digits as in the designs. */
export function relativeTime(iso: string, locale: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now
  const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : locale, { numeric: 'auto' })
  const abs = Math.abs(diff)
  if (abs >= 86_400_000) return rtf.format(Math.round(diff / 86_400_000), 'day')
  if (abs >= 3_600_000) return rtf.format(Math.round(diff / 3_600_000), 'hour')
  return rtf.format(Math.round(diff / 60_000), 'minute')
}
