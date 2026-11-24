<script setup lang="ts">
/**
 * The home-page plans poster (landing #plans), extracted so the landing (R2-13 `259:692`) and the in-app upgrade
 * sheet (R2-4 `264:1321`) render the same design. Release-2 changes only: "Plus" → "Pro", a price row with a
 * monthly / yearly switch, and feature lines built from the plans' limits (never hard-coded values).
 *
 * landing: Free → "ابدأ مجاناً" (waitlist), Pro → "احصل على Tilw Pro" (emits `cta`). The AI demo stays.
 * upgrade: Free → "خطتك الحالية" (disabled) when on Free, Pro → "متابعة على واتساب" / "تجديد عبر واتساب".
 */
import type { Plan, UpgradePeriod } from '~/services/types'
import './plans-poster.css'

const props = withDefaults(defineProps<{
  plans: Plan[]
  mode: 'landing' | 'upgrade'
  /** The person's plan in upgrade mode. */
  current?: string
  busy?: boolean
}>(), { current: 'free', busy: false })
const period = defineModel<UpgradePeriod>('period', { default: 'yearly' })
const emit = defineEmits<{ cta: [] }>()

// The landing stays Arabic-only (release-1 decision); the sheet follows the interface language.
const { t: tUi, locale: uiLocale } = useI18n()
const lang = computed(() => (props.mode === 'landing' ? 'ar' : uiLocale.value))
const t = (key: string, params?: Record<string, unknown>) => tUi(key, params ?? {}, { locale: lang.value })

const free = computed(() => props.plans.find(p => p.key === 'free'))
const pro = computed(() => props.plans.find(p => p.key === 'pro'))
const value = (p: Plan | undefined, key: string) => p?.limits.find(l => l.key === key)?.value

/** Lines from limits, then the always-included basics. */
function lines(p: Plan | undefined, which: 'free' | 'pro'): { text: string; soon?: boolean }[] {
  if (!p) return []
  const out: { text: string; soon?: boolean }[] = []
  const active = value(p, 'scripts.max_active')
  out.push({ text: typeof active === 'number' ? t('plansPoster.activeN', { n: active }) : t('plansPoster.activeUnlimited') })
  const minutes = value(p, 'takes.max_minutes')
  if (typeof minutes === 'number') out.push({ text: t('plansPoster.minutesN', { n: minutes, unit: unitFor(minutes, 'minute', lang.value) }) })
  const providers = value(p, 'storage.providers')
  if (Array.isArray(providers) && providers.includes('google_drive')) {
    out.push({ text: value(p, 'storage.auto_sync') === true ? t('plansPoster.driveAuto') : t('plansPoster.driveManual') })
  }
  const versions = value(p, 'history.versions')
  const days = value(p, 'history.days')
  if (typeof versions === 'number') out.push({ text: t('plansPoster.historyN', { n: versions }) })
  else if (typeof days === 'number') out.push({ text: t('plansPoster.historyDays', { n: days }) })
  // Feature 005: AI credits are real now (backend 004).
  const credits = value(p, 'ai.credits_monthly')
  if (typeof credits === 'number' && credits > 0) out.push({ text: t('plansPoster.aiCredits', { n: credits }) })
  if (which === 'free') {
    out.push({ text: t('plansPoster.basics') })
    out.push({ text: t('plansPoster.phone') })
  }
  return out
}
const freeLines = computed(() => lines(free.value, 'free'))
const proLines = computed(() => lines(pro.value, 'pro'))

const price = computed(() => {
  const p = pro.value
  if (!p) return null
  const cents = period.value === 'yearly' ? p.priceYearlyCents : p.priceMonthlyCents
  return { amount: formatPrice(cents), saving: yearlySaving(p.priceMonthlyCents, p.priceYearlyCents) }
})

const onPro = computed(() => props.mode === 'upgrade' && props.current !== 'free')
const proCta = computed(() => {
  if (props.mode === 'landing') return t('plansPoster.getPro')
  return onPro.value ? t('upgrade.renewWhatsapp') : t('upgrade.continueWhatsapp')
})
</script>

<template>
  <div class="pl-poster" :class="{ 'pl-compact': mode === 'upgrade' }" :dir="lang === 'ar' ? 'rtl' : 'ltr'" :lang="lang">
    <div class="pl-half pl-free">
      <span class="pl-kick">{{ t('plansPoster.freeKick') }}</span>
      <span class="pl-big">{{ t('plansPoster.freeName') }}</span>
      <ul>
        <li v-for="(l, i) in freeLines" :key="i" :style="{ '--i': i }"><span class="pl-ck" />{{ l.text }}</li>
      </ul>
      <a v-if="mode === 'landing'" class="pl-btn pl-btn-light" href="/waitlist">{{ t('plansPoster.startFree') }} <svg class="pl-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6" /></svg></a>
      <button v-else type="button" class="pl-btn pl-btn-light" :disabled="current === 'free'">{{ current === 'free' ? t('upgrade.currentPlan') : t('plansPoster.freeName') }}</button>
    </div>

    <div class="pl-half pl-plus">
      <div v-if="mode === 'landing'" id="pl-dots" class="pl-dots" />
      <span class="pl-kick">{{ onPro ? t('upgrade.currentPlan') : t('plansPoster.proKick') }}</span>
      <span class="pl-big pl-lat">Tilw Pro</span>

      <div class="pl-switch" role="radiogroup" :aria-label="t('plansPoster.periodLabel')">
        <button v-for="p in (['monthly', 'yearly'] as const)" :key="p" type="button" role="radio" :aria-checked="period === p" @click="period = p">{{ t(`plansPoster.${p}`) }}</button>
      </div>
      <div v-if="price" class="pl-price" aria-live="polite">
        <span class="pl-amount" dir="ltr">{{ price.amount }}</span>
        <span class="pl-per">{{ period === 'yearly' ? t('plansPoster.perYear') : t('plansPoster.perMonth') }}</span>
        <span v-if="period === 'yearly' && price.saving" class="pl-save">{{ t('plansPoster.save', { n: price.saving }) }}</span>
      </div>

      <ul>
        <li v-for="(l, i) in proLines" :key="i" :class="{ soon: l.soon }"><span class="pl-ck" />{{ l.text }}</li>
      </ul>

      <div v-if="mode === 'landing'" id="pl-ai" class="pl-ai"><span class="pl-scan" />
        <div class="pl-lab"><svg class="pl-spark" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9zM19 15l.9 2.6 2.6.9-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9z" /></svg>اقتراح توزيع الأسطر</div>
        <div class="pl-words" />
        <div class="pl-note">الكلمات نفسها. راجع الاقتراح قبل تطبيقه.<button type="button" class="pl-apply" tabindex="-1">تطبيق</button></div>
      </div>

      <small>{{ t('plansPoster.note') }}</small>
      <button type="button" class="pl-btn pl-btn-cue" :aria-busy="busy || undefined" :disabled="busy" @click="emit('cta')">
        {{ proCta }} <svg class="pl-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </button>
    </div>
  </div>
</template>
