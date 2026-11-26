import { describeAiError, type AiErrorKind } from '~/services/ai/errors'

/** Feature 005: shared wording for credits, dates and AI errors (`ai.errors.<kind>`). */
export function useAiText() {
  const { t, locale } = useI18n()
  const ai = useAiStore()

  const credits = (n: number) => t('ai.common.credits', { n }, n)

  /** The 1st of next month (UTC), as the person's local date. */
  const renewDate = computed(() => {
    const iso = ai.credits?.renewsAt ?? (() => {
      const d = new Date()
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString()
    })()
    return new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(iso))
  })

  function dateTime(iso: string) {
    return new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  }

  /** Title and text for an AI error, with balance, cost and the renewal date filled in. */
  function errorCopy(e: unknown): { kind: AiErrorKind; title: string; text: string } {
    const { kind, params } = describeAiError(e)
    return copyFor(kind, params)
  }

  function copyFor(kind: AiErrorKind | 'provider_failed' | 'nothing_heard', params: { balance?: number; cost?: number; wait?: number; minutes?: number; max?: number; words?: number } = {}) {
    const p = {
      balance: params.balance ?? ai.balance ?? 0,
      cost: credits(params.cost ?? 1),
      wait: params.wait ?? 0,
      minutes: params.minutes ?? 60,
      max: params.max ?? 0,
      words: params.words ?? 0,
      date: renewDate.value,
    }
    const text = (kind === 'unavailable' || kind === 'rate_limited') && params.wait
      ? t(`ai.errors.${kind}.textWait`, p)
      : t(`ai.errors.${kind}.text`, p)
    return { kind: kind as AiErrorKind, title: t(`ai.errors.${kind}.title`, p), text }
  }

  return { credits, renewDate, dateTime, errorCopy, copyFor }
}
