<script setup lang="ts">
/**
 * Format for reading (A2: cost `292:101`, formatting `293:260`, preview `293:377`, own key refused `294:298`, messages
 * `294:416`; phone sheet `297:461`). The History drawer layout: a side panel on desktop, a bottom sheet on phones.
 *
 * The cost and how it is paid show before anything is spent (US1 #1). Formatting can take a minute; the request keeps
 * going in the store if the drawer closes, and the waiting suggestion opens again later (research R7). Apply is a
 * versioned save: pending edits are saved first, and a newer copy elsewhere answers `conflict` (US1 #5, #6).
 */
import { PortError, type FormatEstimate, type FormatSuggestion } from '~/services/types'
import type { AiErrorKind } from '~/services/ai/errors'

const props = defineProps<{ scriptId: string; direction: 'rtl' | 'ltr' }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const ai = useAiStore()
const editor = useEditorStore()
const plan = usePlanStore()
const upgrade = useUpgrade()
const { show } = useToast()
const { credits, errorCopy, dateTime } = useAiText()
const titleId = useId()
const panel = ref<HTMLElement>()

type View = 'loading' | 'cost' | 'working' | 'preview' | 'error'
const view = ref<View>('loading')
const estimate = ref<FormatEstimate | null>(null)
const error = ref<{ kind: AiErrorKind; title: string; text: string } | null>(null)
const showOriginal = ref(false)
const busy = ref(false)
const live = ref('')

const suggestion = computed<FormatSuggestion | null>(() => ai.suggestions[props.scriptId] ?? null)
const working = computed(() => !!ai.formatting[props.scriptId])

async function loadCost() {
  view.value = 'loading'
  error.value = null
  try {
    estimate.value = await ai.estimate(props.scriptId)
    view.value = 'cost'
  } catch (e) {
    fail(e)
  }
}

onMounted(async () => {
  nextTick(() => panel.value?.focus())
  if (working.value) {
    view.value = 'working'
    return
  }
  if (suggestion.value) {
    view.value = 'preview'
    return
  }
  if (!(props.scriptId in ai.suggestions)) {
    const s = await ai.loadSuggestion(props.scriptId).catch(() => null)
    if (s) {
      view.value = 'preview'
      return
    }
  }
  await loadCost()
})
// A request started before the drawer opened finishes while it is open.
watch(working, (w) => {
  if (!w && view.value === 'working' && suggestion.value) {
    view.value = 'preview'
    live.value = t('ai.format.ready')
  }
})
onKeyStroke('Escape', () => emit('close'))

function fail(e: unknown) {
  const copy = errorCopy(e)
  error.value = copy
  view.value = 'error'
  live.value = copy.title
}

const words = computed(() => estimate.value?.words ?? editor.words)
const empty = computed(() => !editor.body.trim())
const ownKey = computed(() => estimate.value?.ownKey ?? null)
const paidLine = computed(() => {
  const e = estimate.value
  if (!e) return ''
  if (e.paidWith === 'own_key' && e.ownKey) return t('ai.format.paidOwnKey', { provider: providerName(e.ownKey.provider), last4: e.ownKey.last4 })
  if (e.ownKey && e.ownKey.reason) return t('ai.format.keyNotUsed')
  if (e.ownKey && !e.ownKey.usable) return t('ai.format.keyFailing')
  return t('ai.format.paidCredits')
})
const shortCopy = computed(() => {
  const e = estimate.value
  if (!e || e.enough) return null
  return errorCopy(new PortError('limit_reached', undefined, undefined, { key: 'ai.credits_monthly', value: null, usage: null }, { balance: e.balance, cost: e.credits }))
})
const canFormat = computed(() => !!estimate.value?.enough && !empty.value && !editor.readOnly && !busy.value)

function providerName(p: string) {
  return p === 'openai' ? 'OpenAI' : 'Anthropic'
}

/**
 * Pending edits are saved first (US1 #5). Anything short of a clean save stops here: Apply would drop the unsaved
 * edits (adoptRestored clears the draft and undo), and Format would charge for the older saved text.
 */
async function savedFirst(): Promise<boolean> {
  if (editor.dirty || editor.saveState !== 'saved') await editor.save()
  if (editor.saveState === 'conflict') {
    emit('close') // the release-1 conflict screen takes over
    return false
  }
  if (editor.dirty || editor.saveState !== 'saved') {
    const copy = { kind: 'save_failed' as const, title: t('ai.format.saveFailed.title'), text: t('ai.format.saveFailed.text') }
    error.value = copy
    view.value = 'error'
    live.value = copy.title
    return false
  }
  return true
}
/** Back from the save message: to the waiting suggestion, or to the cost. */
function back() {
  error.value = null
  if (suggestion.value) view.value = 'preview'
  else void loadCost()
}

async function format(useCredits = false) {
  if (busy.value) return
  busy.value = true
  error.value = null
  try {
    // The suggestion is made from the saved text.
    if (!(await savedFirst())) return
    view.value = 'working'
    live.value = t('ai.format.working')
    await ai.format(props.scriptId, { useCredits })
    view.value = 'preview'
    live.value = t('ai.format.ready')
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}

async function apply() {
  if (busy.value) return
  busy.value = true
  try {
    if (!(await savedFirst())) return
    const s = await ai.apply(props.scriptId)
    editor.adoptRestored(s)
    show(t('ai.format.applied'), 'success', 6000)
    emit('close')
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}

async function discard() {
  if (busy.value) return
  busy.value = true
  try {
    await ai.discard(props.scriptId)
    show(t('ai.format.discarded'))
    emit('close')
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}

const errorTone = computed(() => (['credits', 'negative', 'conflict', 'gone', 'rate_limited', 'read_only', 'save_failed'].includes(error.value?.kind ?? '') ? 'warning' : 'error'))
const keyRefusedCost = computed(() => credits(estimate.value?.credits ?? Math.max(1, Math.ceil(words.value / 1000))))
const expires = computed(() => (suggestion.value ? dateTime(suggestion.value.expiresAt) : ''))
const title = computed(() => (view.value === 'preview' ? t('ai.format.previewTitle') : t('ai.format.title')))
const spentLine = computed(() => {
  const s = suggestion.value
  if (!s) return ''
  return s.paidWith === 'own_key' ? t('ai.format.spentOwnKey') : t('ai.format.spent', { cost: credits(s.credits), balance: ai.balance ?? s.balance })
})
const goLabel = computed(() => (estimate.value?.paidWith === 'own_key' ? t('ai.format.goOwnKey') : t('ai.format.go', { cost: credits(estimate.value?.credits ?? 1) })))
</script>

<template>
  <div class="scrim" aria-hidden="true" @click="emit('close')" />
  <section ref="panel" class="drawer" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1" data-testid="format-drawer">
    <header>
      <h2 :id="titleId">{{ title }}</h2>
      <UiButton size="sm" tone="secondary" @click="emit('close')">{{ t('ai.common.close') }}</UiButton>
    </header>
    <p class="visually-hidden" aria-live="polite">{{ live }}</p>

    <div class="scroll">
      <!-- loading -->
      <div v-if="view === 'loading'" class="skel" aria-busy="true"><UiSkeleton h="22px" w="70%" /><UiSkeleton h="170px" r="10px" /><UiSkeleton h="48px" r="8px" /></div>

      <!-- cost (A2 `292:101`) -->
      <template v-else-if="view === 'cost' && estimate">
        <p class="lede">{{ t('ai.format.lede') }}</p>
        <div class="card" data-testid="format-cost">
          <span class="lbl">{{ t('ai.format.cost') }}</span>
          <b class="big">{{ estimate.paidWith === 'own_key' ? t('ai.tools.formatOwnKey') : credits(estimate.credits) }}</b>
          <span class="muted">{{ t('ai.format.costRule', { words }) }}</span>
          <hr>
          <span class="bal" data-testid="format-balance">{{ t('ai.format.balanceNow', { n: estimate.balance }) }}</span>
          <span class="muted">{{ paidLine }}</span>
        </div>

        <AiMessage v-if="editor.readOnly" :title="t('ai.errors.read_only.title')" :text="t('ai.format.readOnly')" />
        <AiMessage v-else-if="empty" :title="t('ai.format.empty')" tone="info" />
        <AiMessage v-else-if="shortCopy" :title="shortCopy.title" :text="shortCopy.text" data-testid="format-short">
          <template #actions>
            <UiButton v-if="!plan.isPro" @click="upgrade.open()">{{ t('ai.common.upgrade') }}</UiButton>
            <UiButton tone="secondary" to="/app/settings/ai">{{ t('ai.common.creditsLink') }}</UiButton>
          </template>
        </AiMessage>

        <UiButton block :disabled="!canFormat" :loading="busy" data-testid="format-go" @click="format()">{{ goLabel }}</UiButton>
        <p class="note">{{ t('ai.format.note') }}</p>
        <NuxtLink v-if="!shortCopy" to="/app/settings/ai" class="link">{{ t('ai.common.creditsLink') }}</NuxtLink>
      </template>

      <!-- formatting (A2 `293:260`) -->
      <template v-else-if="view === 'working'">
        <div class="card progress" aria-busy="true">
          <b class="big sm">{{ t('ai.format.working') }}</b>
          <span class="track"><span class="bar" /></span>
          <span class="muted">{{ t('ai.format.workingNote') }}</span>
        </div>
      </template>

      <!-- preview (A2 `293:377`) -->
      <template v-else-if="view === 'preview' && suggestion">
        <UiSegmented
          v-model="showOriginal"
          :label="t('ai.format.previewTitle')"
          :options="[{ value: false, label: t('ai.format.formatted') }, { value: true, label: t('ai.format.original') }] as { value: any; label: string }[]"
        />
        <MarkedPreview
          v-if="showOriginal"
          :body="editor.body"
          :marks="editor.marks"
          :direction="direction"
        />
        <MarkedPreview v-else :body="suggestion.body" :marks="suggestion.marks" :direction="direction" data-testid="format-preview" />
        <p class="note">{{ t('ai.format.same', { when: expires }) }}</p>
        <p class="note strong">{{ spentLine }}</p>
      </template>

      <!-- errors (A2 `294:298`, `294:416`) -->
      <template v-else-if="view === 'error' && error">
        <AiMessage :title="error.title" :text="error.text" :tone="errorTone" data-testid="format-error">
          <template #actions>
            <template v-if="error.kind === 'key_refused'">
              <UiButton :loading="busy" @click="format(true)">{{ t('ai.format.useCredits', { cost: keyRefusedCost }) }}</UiButton>
              <UiButton tone="secondary" to="/app/settings/ai">{{ t('ai.format.checkKey') }}</UiButton>
            </template>
            <template v-else-if="error.kind === 'conflict'">
              <UiButton :loading="busy" @click="loadCost()">{{ t('ai.format.formatAgain') }}</UiButton>
              <UiButton tone="secondary" @click="discard">{{ t('ai.format.discard') }}</UiButton>
            </template>
            <template v-else-if="error.kind === 'credits' || error.kind === 'negative'">
              <UiButton v-if="!plan.isPro" @click="upgrade.open()">{{ t('ai.common.upgrade') }}</UiButton>
              <UiButton tone="secondary" to="/app/settings/ai">{{ t('ai.common.creditsLink') }}</UiButton>
            </template>
            <template v-else-if="error.kind === 'save_failed'">
              <UiButton tone="secondary" @click="back">{{ t('library.back') }}</UiButton>
            </template>
            <template v-else-if="error.kind === 'read_only'">
              <UiButton tone="secondary" @click="emit('close')">{{ t('ai.common.close') }}</UiButton>
            </template>
            <template v-else>
              <UiButton tone="secondary" @click="loadCost()">{{ t('ai.common.retry') }}</UiButton>
            </template>
          </template>
        </AiMessage>
        <span v-if="ownKey && error.kind === 'key_refused'" class="muted">{{ providerName(ownKey.provider) }} ••••{{ ownKey.last4 }}</span>
      </template>
    </div>

    <footer v-if="view === 'preview' && suggestion">
      <UiButton block :loading="busy" :disabled="editor.readOnly" data-testid="format-apply" @click="apply">{{ t('ai.format.apply') }}</UiButton>
      <UiButton block tone="secondary" :disabled="busy" data-testid="format-discard" @click="discard">{{ t('ai.format.discard') }}</UiButton>
      <p class="note">{{ t('ai.format.applyNote') }}</p>
    </footer>
  </section>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: 30;
  background: var(--tilw-scrim);
}
.drawer {
  position: fixed;
  inset-block: 0;
  inset-inline-end: 0;
  z-index: 31;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  inline-size: min(428px, 100vw);
  background: var(--tilw-surface-paper);
  color: var(--tilw-text-ink);
  box-shadow: var(--tilw-shadow-pop);
  outline: none;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 24px 24px 16px;
  border-block-end: 1px solid var(--tilw-border-subtle);
}
h2 {
  margin: 0;
  font: 700 25px/1.36 var(--tilw-font-ar);
}
.scroll {
  display: grid;
  align-content: start;
  gap: 16px;
  padding: 18px 24px 24px;
  overflow-y: auto;
}
.lede,
.note,
.muted {
  margin: 0;
  color: var(--tilw-text-muted);
  font: 400 14px/1.6 var(--tilw-font-ar);
}
.note.strong {
  color: var(--tilw-text-ink);
  font-weight: 500;
}
.card {
  display: grid;
  gap: 8px;
  padding: 18px;
  border-radius: 10px;
  background: var(--tilw-surface-white);
}
.card hr {
  margin: 4px 0;
  border: 0;
  border-block-start: 1px solid var(--tilw-border-subtle);
}
.lbl {
  color: var(--tilw-text-muted);
  font: 500 14px/1.4 var(--tilw-font-ar);
}
.big {
  font: 700 32px/1.3 var(--tilw-font-ar);
}
.big.sm {
  font-size: 20px;
}
.bal {
  font: 500 15px/1.5 var(--tilw-font-ar);
}
.link {
  color: var(--tilw-action-primary);
  font: 500 15px/1.4 var(--tilw-font-ar);
}
.track {
  position: relative;
  display: block;
  block-size: 6px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--tilw-surface-quiet);
}
.bar {
  position: absolute;
  inset-block: 0;
  inline-size: 40%;
  border-radius: 3px;
  background: var(--tilw-action-primary);
  animation: slide 1.6s ease-in-out infinite;
}
@keyframes slide {
  from { inset-inline-start: -40%; }
  to { inset-inline-start: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .bar { animation: none; inset-inline-start: 30%; }
}
.skel {
  display: grid;
  gap: 12px;
}
footer {
  display: grid;
  gap: 10px;
  padding: 16px 24px calc(20px + env(safe-area-inset-bottom, 0px));
  border-block-start: 1px solid var(--tilw-border-subtle);
}
@media (max-width: 760px) {
  .drawer {
    inset-block: auto 0;
    inset-inline: 0;
    inline-size: 100%;
    block-size: min(720px, 88dvh);
    border-start-start-radius: 19px;
    border-start-end-radius: 19px;
    overflow: hidden;
  }
}
</style>
