<script setup lang="ts" generic="M extends 'single' | 'range' = 'single'">
/**
 * Date picker built on flatpickr (loaded lazily on first open, browser only). The trigger is a button with
 * role="combobox" and aria-haspopup="dialog"; the calendar is flatpickr's inline calendar inside a popup in the top
 * layer (works inside modal dialogs), themed by assets/css/flatpickr-tilw.css.
 *
 * v-model: `YYYY-MM-DD` or null; with mode="range", `{ from, to }` (both `YYYY-MM-DD`) or null. Range mode shows
 * quick presets (last 7 / 30 / 90 days, this month), clamped to min / max.
 *
 * Locale follows the current i18n locale (Arabic: Arabic names, Saturday first, right-to-left grid with ← / →
 * swapped so they move the way they look). Keyboard: ↓ / Alt+↓ / Enter / Space on the trigger open; in the calendar
 * the arrows move by day / week, Enter picks, Esc closes and returns focus.
 */
import { computed, nextTick, onBeforeUnmount, ref, useId, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Instance } from 'flatpickr/dist/types/instance'
import type { CustomLocale } from 'flatpickr/dist/types/locale'
import UiGlyph from './UiGlyph.vue'
import { formatIsoDate, fromIsoDate, presetRange, toIsoDate, UI_DATE_PRESETS, type UiDatePreset, type UiDateRange } from '~/utils/uiControls'
import { useAnchoredPopover } from '~/composables/useAnchoredPopover'
import '~/assets/css/flatpickr-tilw.css'

type Model = M extends 'range' ? UiDateRange | null : string | null

const model = defineModel<Model>()
/** Conditional model types don't narrow inside the component: read and write through these. */
const raw = computed(() => (model.value ?? null) as unknown as string | UiDateRange | null)
const props = withDefaults(
  defineProps<{
    mode?: M
    /** Earliest / latest selectable day, `YYYY-MM-DD`. */
    min?: string | null
    max?: string | null
    placeholder?: string
    clearable?: boolean
    /** Range mode: show the quick presets (default true). */
    presets?: boolean
    disabled?: boolean
    size?: 'sm' | 'md'
    error?: boolean | string
    id?: string
    label?: string
    ariaLabelledby?: string
    ariaDescribedby?: string
  }>(),
  {
    mode: undefined,
    min: null,
    max: null,
    placeholder: undefined,
    clearable: true,
    presets: true,
    size: 'md',
    error: false,
    id: undefined,
    label: undefined,
    ariaLabelledby: undefined,
    ariaDescribedby: undefined,
  },
)
const emit = defineEmits<{ change: [value: Model]; open: []; close: [] }>()

const { t, locale } = useI18n()
const uid = useId()
const triggerId = computed(() => props.id ?? `${uid}-trigger`)
const popId = `${uid}-cal`
const errId = `${uid}-err`

const root = ref<HTMLElement>()
const box = ref<HTMLElement>()
const pop = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const fpInput = ref<HTMLInputElement>()
const { open, show, hide, position } = useAnchoredPopover(root, box, pop, { matchWidth: false })
const ready = ref(false)
let fp: Instance | null = null
let loading: Promise<void> | null = null

const isRange = computed(() => props.mode === 'range')
const range = computed(() => (isRange.value ? (raw.value as UiDateRange | null) : null))
const single = computed(() => (isRange.value ? null : (raw.value as string | null)))
const hasValue = computed(() => (isRange.value ? !!range.value?.from : !!single.value))
const display = computed(() => {
  if (isRange.value) {
    const r = range.value
    if (!r?.from) return ''
    return `${formatIsoDate(r.from, locale.value)} – ${formatIsoDate(r.to, locale.value)}`
  }
  return formatIsoDate(single.value, locale.value)
})
const placeholderText = computed(() => props.placeholder ?? t(isRange.value ? 'ui.date.placeholderRange' : 'ui.date.placeholder'))
const invalid = computed(() => !!props.error)
const errorText = computed(() => (typeof props.error === 'string' && props.error ? props.error : ''))
const describedby = computed(() => [props.ariaDescribedby, errorText.value ? errId : ''].filter(Boolean).join(' ') || undefined)
const presetList = computed(() =>
  UI_DATE_PRESETS.map(p => ({ id: p, range: presetRange(p, new Date(), props.min, props.max) })),
)

watch(open, v => (v ? emit('open') : emit('close')))

function currentDates(): Date[] {
  if (isRange.value) {
    const r = range.value
    return [fromIsoDate(r?.from), fromIsoDate(r?.to)].filter((d): d is Date => !!d)
  }
  const d = fromIsoDate(single.value)
  return d ? [d] : []
}

function setModel(v: string | UiDateRange | null) {
  ;(model as unknown as Ref<unknown>).value = v
  emit('change', v as Model)
}

async function load() {
  if (fp) return
  if (loading) return loading
  loading = (async () => {
    const [{ default: flatpickr }, ar] = await Promise.all([
      import('flatpickr'),
      locale.value === 'ar' ? import('flatpickr/dist/l10n/ar.js') : Promise.resolve(null),
      import('flatpickr/dist/flatpickr.css'),
    ])
    if (!fpInput.value) return
    const arabic = ar ? ((ar as { Arabic?: CustomLocale }).Arabic ?? (ar as { default?: { ar?: CustomLocale } }).default?.ar) : undefined
    fp = flatpickr(fpInput.value, {
      inline: true,
      mode: isRange.value ? 'range' : 'single',
      dateFormat: 'Y-m-d',
      disableMobile: true,
      monthSelectorType: 'static',
      locale: arabic ? { ...arabic, firstDayOfWeek: 6 } : { firstDayOfWeek: 0 },
      minDate: props.min ?? undefined,
      maxDate: props.max ?? undefined,
      defaultDate: currentDates(),
      onChange: onPick,
    }) as Instance
    ready.value = true
  })()
  try {
    await loading
  } finally {
    loading = null
  }
}

function onPick(dates: Date[]) {
  if (isRange.value) {
    if (dates.length < 2) return
    const [a, b] = [toIsoDate(dates[0]!), toIsoDate(dates[1]!)]
    setModel(a <= b ? { from: a, to: b } : { from: b, to: a })
  } else {
    if (!dates[0]) return
    setModel(toIsoDate(dates[0]))
  }
  close(true)
}

function focusDay() {
  const cal = pop.value
  const day =
    cal?.querySelector<HTMLElement>('.flatpickr-day.selected:not(.flatpickr-disabled)') ??
    cal?.querySelector<HTMLElement>('.flatpickr-day.today:not(.flatpickr-disabled)') ??
    cal?.querySelector<HTMLElement>('.flatpickr-day:not(.flatpickr-disabled):not(.prevMonthDay):not(.nextMonthDay)')
  day?.focus()
}

async function openCal(focus = true) {
  if (props.disabled) return
  await show()
  await load()
  if (!open.value) return
  if (fp) {
    const dates = currentDates()
    fp.setDate(dates, false)
    fp.jumpToDate(dates[0] ?? fromIsoDate(props.max) ?? new Date())
  }
  await nextTick()
  position()
  if (focus) focusDay()
}

function close(refocus = false) {
  hide()
  if (refocus) trigger.value?.focus()
}

function toggle() {
  if (open.value) close()
  else void openCal()
}

function clear() {
  if (props.disabled) return
  fp?.clear(false)
  setModel(null)
  trigger.value?.focus()
}

function applyPreset(p: UiDatePreset) {
  const r = presetRange(p, new Date(), props.min, props.max)
  if (!r) return
  setModel(r)
  close(true)
}

function onTriggerKey(e: KeyboardEvent) {
  if (props.disabled) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!open.value) void openCal()
    else focusDay()
  } else if (e.key === 'Escape' && open.value) {
    e.preventDefault()
    e.stopPropagation()
    close()
  }
}

type DayEl = HTMLElement & { dateObj?: Date }

/** Focus the day `delta` days from `from` (changing month when needed); disabled days are skipped over. */
function moveDay(from: DayEl, delta: number) {
  const d = from.dateObj
  if (!d || !fp || !pop.value) return
  const find = (iso: string) =>
    [...pop.value!.querySelectorAll<DayEl>('.flatpickr-day:not(.prevMonthDay):not(.nextMonthDay)')].find(
      el => el.dateObj && toIsoDate(el.dateObj) === iso,
    )
  for (let step = 1; step <= 31; step++) {
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta * step)
    const iso = toIsoDate(next)
    if ((props.min && iso < props.min) || (props.max && iso > props.max)) return
    let el = find(iso)
    if (!el) {
      fp.changeMonth(next.getMonth() - fp.currentMonth + 12 * (next.getFullYear() - fp.currentYear))
      el = find(iso)
    }
    if (el && !el.classList.contains('flatpickr-disabled')) {
      el.focus()
      return
    }
  }
}

function onPopKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    close(true)
    return
  }
  // flatpickr moves ← / → by date and doesn't know about RTL, where the grid runs right to left: there ← is the
  // next day. Handle both arrows ourselves in RTL so they move the way they look.
  const target = e.target as DayEl | null
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.ctrlKey && target?.classList.contains('flatpickr-day')) {
    if (getComputedStyle(target).direction !== 'rtl') return
    e.stopPropagation()
    e.preventDefault()
    moveDay(target, e.key === 'ArrowLeft' ? 1 : -1)
  }
}

function onPopFocusOut(e: FocusEvent) {
  const next = e.relatedTarget as Node | null
  // Tabbing out of the calendar closes it; clicks inside (relatedTarget null) don't.
  if (next && !root.value?.contains(next)) close()
}

function destroy() {
  fp?.destroy()
  fp = null
  ready.value = false
}

// A new locale or mode needs a new calendar (names, first weekday, range behaviour).
watch([locale, () => props.mode], () => {
  const wasOpen = open.value
  destroy()
  if (wasOpen) void openCal(false)
})
watch(() => props.min, v => fp?.set('minDate', v || null))
watch(() => props.max, v => fp?.set('maxDate', v || null))

onBeforeUnmount(destroy)

defineExpose({ focus: () => trigger.value?.focus(), open: () => openCal(), close: () => close() })
</script>

<template>
  <div ref="root" class="ui-date" :class="[`size-${size}`, { invalid, disabled, 'is-open': open }]">
    <div ref="box" class="box">
      <UiGlyph name="calendar" :size="size === 'sm' ? 16 : 20" class="lead" />
      <button
        :id="triggerId"
        ref="trigger"
        type="button"
        role="combobox"
        class="trigger"
        :disabled="disabled"
        aria-haspopup="dialog"
        :aria-expanded="open ? 'true' : 'false'"
        :aria-controls="popId"
        :aria-invalid="invalid ? 'true' : undefined"
        :aria-label="label"
        :aria-labelledby="ariaLabelledby"
        :aria-describedby="describedby"
        @click="toggle"
        @keydown="onTriggerKey"
      >
        <span v-if="display" class="value">{{ display }}</span>
        <span v-else class="placeholder">{{ placeholderText }}</span>
      </button>
      <button
        v-if="clearable && hasValue && !disabled"
        type="button"
        class="clear"
        :aria-label="t('ui.date.clear')"
        @click="clear"
      >
        <UiGlyph name="close" :size="16" />
      </button>
    </div>
    <p v-if="errorText" :id="errId" class="msg">{{ errorText }}</p>

    <div
      v-show="open"
      :id="popId"
      ref="pop"
      popover="manual"
      role="dialog"
      :aria-label="t(isRange ? 'ui.date.calendarRange' : 'ui.date.calendar')"
      class="ui-date-pop"
      @keydown="onPopKey"
      @focusout="onPopFocusOut"
    >
      <div class="pop-body">
      <div v-if="isRange && presets" class="presets" role="group" :aria-label="t('ui.date.presets.label')">
        <button
          v-for="p in presetList"
          :key="p.id"
          type="button"
          class="preset"
          :disabled="!p.range"
          :aria-pressed="!!p.range && range?.from === p.range.from && range?.to === p.range.to ? 'true' : 'false'"
          @click="applyPreset(p.id)"
        >
          {{ t(`ui.date.presets.${p.id}`) }}
        </button>
      </div>
      <div class="cal">
        <p v-if="!ready" class="loading">{{ t('ui.date.loading') }}</p>
        <input ref="fpInput" class="fp-input" type="text" tabindex="-1" aria-hidden="true">
      </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ui-date {
  --ui-h: var(--tilw-field-h);
  --ui-pad: var(--tilw-space-16);
  --ui-font: 500 16px/1.34 var(--tilw-font-ar);
  display: grid;
  gap: var(--tilw-space-4);
  min-inline-size: 0;
}
.size-sm {
  --ui-h: 36px;
  --ui-pad: var(--tilw-space-12);
  --ui-font: 500 14px/1.3 var(--tilw-font-ar);
}
.box {
  display: flex;
  align-items: center;
  gap: 4px;
  block-size: var(--ui-h);
  padding-inline: var(--ui-pad) calc(var(--ui-pad) - 8px);
  box-sizing: border-box;
  border: 1px solid var(--tilw-control-edge);
  border-radius: var(--tilw-radius-field);
  background: var(--tilw-control-fill);
  color: var(--tilw-text-ink);
  transition: border-color 0.15s, box-shadow 0.15s, background-color 0.12s;
}
.box:hover {
  border-color: var(--tilw-control-edge-hover);
  background: var(--tilw-control-fill-hover);
}
.box:focus-within,
.is-open .box {
  border-color: var(--tilw-focus-ring);
  box-shadow: 0 0 0 1px var(--tilw-focus-ring);
}
.invalid .box {
  border-color: var(--tilw-status-error);
}
.invalid .box:focus-within {
  box-shadow: 0 0 0 1px var(--tilw-status-error);
}
.disabled .box {
  border-color: var(--tilw-control-edge-disabled);
  background: var(--tilw-surface-quiet);
  color: var(--tilw-text-muted);
  cursor: not-allowed;
}
.lead {
  color: var(--tilw-text-muted);
}
.trigger {
  flex: 1;
  min-inline-size: 0;
  block-size: 100%;
  padding-inline: 4px 0;
  border: 0;
  background: none;
  color: inherit;
  font: var(--ui-font);
  text-align: start;
  cursor: pointer;
  outline: none;
}
.trigger:disabled {
  cursor: not-allowed;
}
.value,
.placeholder {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.placeholder {
  color: var(--tilw-text-muted);
}
.clear {
  display: grid;
  place-items: center;
  inline-size: 28px;
  block-size: 28px;
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  border-radius: var(--tilw-radius-pill);
  background: none;
  color: var(--tilw-text-muted);
  cursor: pointer;
}
.clear:hover {
  background: var(--tilw-surface-quiet);
  color: var(--tilw-text-ink);
}
.clear:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 1px;
}
.msg {
  color: var(--tilw-status-error);
  font: var(--tilw-type-caption);
}

.ui-date-pop {
  box-sizing: border-box;
  max-inline-size: calc(100vw - 16px);
  overflow: auto;
  padding: 8px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: var(--tilw-radius-card);
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
  box-shadow: var(--tilw-shadow-pop);
}
.pop-body {
  display: flex;
  gap: 8px;
}
.presets {
  display: grid;
  align-content: start;
  gap: 4px;
  min-inline-size: 120px;
  padding-inline-end: 8px;
  border-inline-end: 1px solid var(--tilw-border-subtle);
}
.preset {
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--tilw-text-ink);
  font: 500 13px/1.3 var(--tilw-font-ar);
  text-align: start;
  white-space: nowrap;
  cursor: pointer;
}
.preset:hover:not(:disabled) {
  background: var(--tilw-surface-quiet);
}
.preset[aria-pressed='true'] {
  background: var(--tilw-surface-selected);
  font-weight: 600;
}
.preset:disabled {
  color: var(--tilw-text-muted);
  opacity: 0.6;
  cursor: not-allowed;
}
.preset:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: -2px;
}
.cal {
  position: relative;
  min-inline-size: 280px;
}
.loading {
  padding: 24px;
  color: var(--tilw-text-muted);
  font: var(--tilw-type-meta);
  text-align: center;
}
.fp-input {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  padding: 0;
  border: 0;
  opacity: 0;
  pointer-events: none;
}
@media (max-width: 480px) {
  .pop-body {
    flex-direction: column;
  }
  .presets {
    grid-auto-flow: column;
    overflow-x: auto;
    padding-inline-end: 0;
    padding-block-end: 8px;
    border-inline-end: 0;
    border-block-end: 1px solid var(--tilw-border-subtle);
  }
}
</style>
