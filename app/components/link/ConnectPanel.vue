<script setup lang="ts">
/**
 * Feature 004, Connect phone (Figma L1: waiting `276:158`, connected `276:218`, locked `276:278`). Docked like the
 * reading-settings drawer on desktop, a sheet on phones. Shows the QR, the 6-digit code and its countdown while
 * waiting; the phone, the previews switch and End link once connected; a waiting second phone; why a link ended;
 * and the locked, unavailable and other-tab states.
 */
const props = defineProps<{ scriptId: string }>()
const emit = defineEmits<{ close: [] }>()

const { t, locale } = useI18n()
const link = useLinkStore()
const upgrade = useUpgrade()
const errorText = useErrorText()
const titleId = useId()
const now = shallowRef(new Date())
useIntervalFn(() => (now.value = new Date()), 1000)

const s = computed(() => link.state)
const status = computed(() => link.status)
const remote = computed(() => s.value?.link?.remote ?? null)

const remaining = computed(() => {
  const c = link.code
  return c ? Math.max(0, new Date(c.expiresAt).getTime() - now.value.getTime()) : 0
})
const expired = computed(() => !!link.code && remaining.value <= 0)
const countdown = computed(() => {
  const sec = Math.ceil(remaining.value / 1000)
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
})
/** The address to type on the phone: the remote page without the one-time secret. */
const remoteUrl = computed(() => (link.code?.url ?? '').split('#')[0] ?? '')
const address = computed(() => remoteUrl.value.replace(/^https?:\/\//, ''))
const digits = computed(() => (link.code?.code ?? '').replace(/(\d{3})(\d{3})/, '$1 $2'))

const since = computed(() => {
  const at = s.value?.partnerSince
  if (!at) return ''
  const min = Math.max(1, Math.round((now.value.getTime() - at) / 60_000))
  // A duration ("3 minutes" / "3 دقائق"), read after "Connected for" / "متصل منذ".
  return new Intl.NumberFormat(locale.value === 'ar' ? 'ar-u-nu-latn' : 'en', { style: 'unit', unit: 'minute', unitDisplay: 'long' }).format(min)
})

const previews = computed({
  get: () => s.value?.link?.previews ?? true,
  set: v => void link.setPreviews(v),
})

const copied = ref(false)
async function copyAddress() {
  try {
    await navigator.clipboard.writeText(remoteUrl.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch { /* clipboard blocked: the address is on screen */ }
}

const endText = computed(() => {
  const r = s.value?.endReason
  return r ? t(`link.ended.${r}`) : t('link.ended.unknown')
})

const doneBtn = ref<{ $el: HTMLElement }>()
defineExpose({ focus: () => doneBtn.value?.$el.focus() })
</script>

<template>
  <div class="panel" role="dialog" :aria-labelledby="titleId" data-link-panel>
    <div class="head">
      <h2 :id="titleId">{{ t('link.title') }}</h2>
      <UiButton ref="doneBtn" tone="secondary" class="done" @click="emit('close')">{{ t('link.done') }}</UiButton>
    </div>

    <div class="scroll">
      <!-- Not started, or a start failed -->
      <template v-if="status === 'idle'">
        <p class="lede">{{ t('link.intro') }}</p>
        <p v-if="s?.error" class="err" role="alert">{{ errorText(s.error) }}</p>
        <UiButton tone="primary" block @click="link.open(props.scriptId)">{{ t('link.connect') }}</UiButton>
      </template>

      <p v-else-if="status === 'starting'" class="lede" aria-busy="true">{{ t('link.status.starting') }}</p>

      <!-- Waiting for the phone (L1 waiting) -->
      <template v-else-if="status === 'waiting'">
        <p class="lede">{{ t('link.intro') }}</p>
        <div v-if="link.code" class="qr-row">
          <QrCode :value="link.code.url" :label="t('link.qrLabel')" />
        </div>
        <template v-if="link.code && !expired">
          <h3>{{ t('link.codeLabel') }}</h3>
          <p class="code" dir="ltr" :aria-label="link.code.code.split('').join(' ')">{{ digits }}</p>
          <button type="button" class="addr" dir="ltr" @click="copyAddress">
            <UiGlyph :name="copied ? 'check' : 'copy'" :size="18" />
            <span>{{ address }}</span>
            <span class="sr">{{ copied ? t('link.copied') : t('link.copyAddress') }}</span>
          </button>
          <div class="expiry">
            <span><UiGlyph name="clock" :size="18" /> {{ t('link.expiresIn', { time: countdown }) }}</span>
            <UiButton tone="secondary" size="sm" @click="link.newCode()">{{ t('link.newCode') }}</UiButton>
          </div>
        </template>
        <div v-else class="expiry">
          <span>{{ t('link.expired') }}</span>
          <UiButton tone="primary" size="sm" @click="link.newCode()">{{ t('link.newCode') }}</UiButton>
        </div>
        <hr>
        <div class="field">
          <span>{{ t('link.previews') }}</span>
          <UiSwitch v-model="previews" :label="t('link.previews')" />
        </div>
        <p class="hint">{{ t('link.previewsHelp') }}</p>
      </template>

      <!-- A phone is linked (L1 connected), online or not -->
      <template v-else-if="status === 'connected' || status === 'partnerOffline'">
        <div class="card" :class="{ off: status === 'partnerOffline' }">
          <p class="state"><span class="dot" aria-hidden="true" />{{ status === 'connected' ? t('link.connectedTitle') : t('link.offlineTitle') }}</p>
          <p v-if="remote" class="who" dir="auto">{{ remote.name }} · {{ t(`link.kind.${remote.kind}`) }}</p>
          <p class="meta">{{ status === 'connected' ? t('link.connectedSince', { time: since }) : t('link.offlineText') }}</p>
        </div>
        <div v-if="link.pendingRemote" class="card request" role="alert">
          <p class="who" dir="auto">{{ t('link.requestText', { name: link.pendingRemote.name }) }}</p>
          <div class="acts">
            <UiButton tone="secondary" size="sm" @click="link.declineRemote()">{{ t('link.decline') }}</UiButton>
            <UiButton tone="primary" size="sm" @click="link.acceptRemote()">{{ t('link.accept') }}</UiButton>
          </div>
        </div>
        <div class="field">
          <span>{{ t('link.previews') }}</span>
          <UiSwitch v-model="previews" :label="t('link.previews')" />
        </div>
        <p class="hint">{{ t('link.previewsHelp') }}</p>
        <hr>
        <div class="expiry">
          <span>{{ t('link.anotherPhone') }}</span>
          <UiButton tone="secondary" size="sm" @click="link.newCode()">{{ t('link.newCode') }}</UiButton>
        </div>
        <template v-if="link.code && !expired">
          <p class="code small" dir="ltr">{{ digits }}</p>
          <p class="hint">{{ t('link.expiresIn', { time: countdown }) }}</p>
        </template>
      </template>

      <!-- Ended -->
      <template v-else-if="status === 'ended'">
        <div class="card">
          <p class="state">{{ t('link.endedTitle') }}</p>
          <p class="meta">{{ endText }}</p>
        </div>
        <UiButton tone="primary" block @click="link.open(props.scriptId)">{{ t('link.startAgain') }}</UiButton>
      </template>

      <!-- Plan doesn't include phone link (L1 locked) -->
      <template v-else-if="status === 'locked'">
        <div class="card sand">
          <p class="state">{{ t('link.lockedTitle') }}</p>
          <p class="meta">{{ t('link.lockedText') }}</p>
        </div>
        <div class="acts end">
          <UiButton tone="secondary" to="/app/settings/plan">{{ t('link.myPlan') }}</UiButton>
          <UiButton tone="primary" @click="upgrade.open()">{{ t('upgrade.cta') }}</UiButton>
        </div>
      </template>

      <p v-else-if="status === 'unavailable'" class="lede">{{ t('link.unavailableText') }}</p>

      <template v-else-if="status === 'otherTab'">
        <p class="lede">{{ t('link.otherTabText') }}</p>
        <UiButton tone="primary" block @click="link.moveHere(props.scriptId)">{{ t('link.moveHere') }}</UiButton>
      </template>

      <template v-if="status === 'waiting' || status === 'connected' || status === 'partnerOffline'">
        <div class="acts end">
          <UiButton tone="danger" @click="link.end()">{{ t('link.end') }}</UiButton>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  block-size: 100%;
  background: var(--tilw-surface-paper);
  color: var(--tilw-text-ink);
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  block-size: 82px;
  padding-inline: 28px;
  border-block-end: 1px solid var(--tilw-border-subtle);
  background: var(--tilw-surface-white);
}
h2 {
  margin: 0;
  font: 700 26px/1.36 var(--tilw-font-ar);
}
h3 {
  margin: 0;
  font: 500 15px/1.36 var(--tilw-font-ar);
}
.done {
  min-inline-size: 67px;
  padding-inline: 12px;
}
.scroll {
  display: grid;
  align-content: start;
  gap: 16px;
  padding: 24px 28px 40px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.lede,
.hint,
.meta {
  margin: 0;
  color: var(--tilw-text-muted);
  font: 400 15px/1.6 var(--tilw-font-ar);
}
.lede {
  font-size: 16px;
}
.err {
  margin: 0;
  color: var(--tilw-status-error);
  font: 500 15px/1.5 var(--tilw-font-ar);
}
.qr-row {
  display: flex;
  justify-content: center;
}
.code {
  margin: 0;
  padding: 14px 20px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: 12px;
  background: var(--tilw-surface-white);
  font: 700 40px/1.2 var(--tilw-font-latin, var(--tilw-font-ar));
  letter-spacing: 6px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.code.small {
  padding: 8px 14px;
  font-size: 26px;
}
.addr {
  display: inline-flex;
  align-items: center;
  justify-self: end;
  gap: 8px;
  min-block-size: 44px;
  padding: 0 4px;
  border: 0;
  background: none;
  color: var(--tilw-text-ink);
  font: 500 15px/1.36 var(--tilw-font-latin, var(--tilw-font-ar));
}
.addr:focus-visible {
  outline: 2px solid var(--tilw-focus-ring, var(--tilw-action-primary));
  outline-offset: 2px;
}
.sr {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.expiry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--tilw-text-muted);
  font: 400 15px/1.36 var(--tilw-font-ar);
}
.expiry > span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
hr {
  inline-size: 100%;
  margin: 4px 0;
  border: 0;
  border-block-start: 1px solid var(--tilw-border-subtle);
}
.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-block-size: 42px;
  font: 500 17px/1.36 var(--tilw-font-ar);
}
.card {
  display: grid;
  gap: 6px;
  padding: 16px 18px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: 12px;
  background: var(--tilw-surface-white);
}
.card.sand {
  border-color: transparent;
  background: var(--tilw-surface-sand);
}
.card p {
  margin: 0;
}
.state {
  display: flex;
  align-items: center;
  gap: 8px;
  font: 700 18px/1.36 var(--tilw-font-ar);
}
.dot {
  inline-size: 10px;
  block-size: 10px;
  border-radius: 50%;
  background: var(--tilw-status-success);
}
.card.off .dot {
  background: var(--tilw-stage-cue);
}
.who {
  font: 500 16px/1.36 var(--tilw-font-ar);
}
.request {
  border-color: var(--tilw-action-primary);
}
.acts {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.acts.end {
  justify-content: flex-end;
}
</style>
