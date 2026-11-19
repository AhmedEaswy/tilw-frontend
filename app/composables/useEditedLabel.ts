import type { ScriptSummary } from '~/services/types'

/** "تعديل اليوم · نحو 3 د" (6:18 list rows). Dates use Latin digits, as in the designs. */
export function useEditedLabel() {
  const { t, locale } = useI18n()
  const auth = useAuthStore()

  function day(iso: string) {
    const d = new Date(iso)
    const today = new Date()
    const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
    const diff = Math.round((start(today) - start(d)) / 86_400_000)
    if (diff === 0) return t('library.today')
    if (diff === 1) return t('library.yesterday')
    const tag = locale.value === 'ar' ? 'ar-u-nu-latn' : 'en'
    const sameYear = d.getFullYear() === today.getFullYear()
    return new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) }).format(d)
  }

  return (s: ScriptSummary) => {
    const minutes = estimateMinutes(s.wordCount, auth.user?.reading.wpm ?? 120)
    const edited = t('library.edited', { when: day(s.updatedAt) })
    return minutes ? `${edited}  ·  ${t('library.about', { n: minutes })}` : edited
  }
}
