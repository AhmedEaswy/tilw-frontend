<script setup lang="ts">
/**
 * Feature 004: the public phone remote (Figma L4 `278:164` / `278:218`, L5 `278:273` / `278:331`, L6 section `284:276`).
 * No account. Opened from the studio's QR (the one-time secret is in the hash and removed at once) or by typing the
 * 6-digit code; reconnects on its own with the pairing it kept for up to 10 minutes.
 */
import type { CommandType } from '~/services/types'

definePageMeta({ layout: 'remote' })
const { t } = useI18n()
const remote = useRemoteStore()
useHead({ title: () => `${t('remote.pageTitle')} · tilwprompter`, meta: [{ name: 'robots', content: 'noindex' }] })

const s = computed(() => remote.state)
const phase = computed(() => s.value?.phase ?? 'start')
const live = computed(() => !!s.value && s.value.studioPresent && s.value.connection === 'connected')

const code = ref('')
const codeInput = ref<HTMLInputElement>()
const canConnect = computed(() => code.value.replace(/\D/g, '').length === 6 && phase.value !== 'pairing')
const pairError = computed(() => {
  switch (s.value?.pairError) {
    case 'invalid': return t('remote.invalid')
    case 'tooMany': return t('remote.tooMany')
    case 'limit': return t('link.ended.limit')
    case 'network': return t('errors.network')
    default: return ''
  }
})

function onCodeInput(e: Event) {
  code.value = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6)
}
async function connect() {
  if (!canConnect.value) return
  await remote.pairWithCode(code.value)
  if (s.value?.pairError) nextTick(() => codeInput.value?.focus())
}
function send(type: CommandType, extra?: { paragraph?: number; wpm?: number }) {
  void remote.send(type, extra)
}
function again() {
  code.value = ''
  remote.again()
  nextTick(() => codeInput.value?.focus())
}

const endText = computed(() => {
  const r = s.value?.ended
  return r ? t(`link.ended.${r}`) : t('link.ended.unknown')
})

// US2: keep the screen on while connected, and pick the link back up when the network or the page returns.
useWakeLock(() => phase.value === 'connected')
const wake = () => { if (document.visibilityState === 'visible') void remote.wake() }

onMounted(() => {
  // The QR secret is used once: take it out of the address so it isn't kept in history or reused on reload.
  const secret = window.location.hash.slice(1)
  if (secret) history.replaceState(history.state, '', window.location.pathname + window.location.search)
  void remote.start(secret || null)
  window.addEventListener('online', wake)
  document.addEventListener('visibilitychange', wake)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', wake)
  document.removeEventListener('visibilitychange', wake)
})
</script>

<template>
  <!-- Code entry (L4) -->
  <form v-if="phase === 'start' || phase === 'pairing'" class="start" novalidate @submit.prevent="connect">
    <h1>{{ t('remote.heading') }}</h1>
    <p class="lede">{{ t('remote.enterCode') }}</p>
    <label class="field">
      <span class="label">{{ t('remote.codeLabel') }}</span>
      <input
        ref="codeInput"
        class="code"
        :class="{ bad: !!pairError }"
        dir="ltr"
        :value="code"
        inputmode="numeric"
        autocomplete="one-time-code"
        pattern="[0-9]*"
        maxlength="6"
        :aria-invalid="!!pairError"
        :aria-describedby="pairError ? 'code-error' : undefined"
        @input="onCodeInput"
      >
    </label>
    <p v-if="pairError" id="code-error" class="error" role="alert">{{ pairError }}</p>
    <UiButton type="submit" tone="cue" block :disabled="!canConnect" :loading="phase === 'pairing'">
      {{ phase === 'pairing' ? t('remote.connecting') : t('remote.connect') }}
    </UiButton>
    <p class="hint">{{ t('remote.codeHelp') }}</p>
  </form>

  <!-- A second phone waiting for the studio (L6) -->
  <section v-else-if="phase === 'waitingAccept'" class="center" role="status">
    <h1>{{ t('remote.waitingAccept') }}</h1>
    <p class="lede">{{ t('remote.waitingAcceptText') }}</p>
    <UiButton tone="ghost" @click="remote.leave()">{{ t('remote.leave') }}</UiButton>
  </section>

  <!-- Controls (L5) -->
  <section v-else-if="phase === 'connected'" class="connected">
    <div class="topline">
      <p class="status" :class="{ off: !live }" role="status">
        <span class="dot" aria-hidden="true" />{{ live ? t('remote.connected') : t('remote.studioOffline') }}
      </p>
      <UiButton tone="dark" size="sm" @click="remote.leave()">{{ t('remote.leave') }}</UiButton>
    </div>
    <p v-if="!live" class="offline">{{ t('remote.studioOfflineText') }}</p>
    <RemoteControls
      class="controls"
      :state="s?.state ?? null"
      :last-result="s?.lastResult ?? null"
      :disabled="!live"
      :previews="s?.previews ?? true"
      @send="send"
    />
  </section>

  <!-- Ended, replaced, declined, left (L6) -->
  <section v-else class="center" role="status">
    <h1>{{ t('remote.endedTitle') }}</h1>
    <p class="lede">{{ endText }}</p>
    <p class="hint">{{ t('remote.newCodeHint') }}</p>
    <UiButton tone="cue" @click="again">{{ t('remote.enterNewCode') }}</UiButton>
  </section>
</template>

<style scoped>
h1 {
  margin: 0;
  font: 700 28px/1.36 var(--tilw-font-ar);
}
.lede,
.hint {
  margin: 0;
  color: var(--tilw-stage-secondary);
  font: 400 16px/1.6 var(--tilw-font-ar);
}
.hint {
  font-size: 15px;
}
.start {
  display: grid;
  gap: 22px;
  padding-block-start: 40px;
}
.field {
  display: grid;
  gap: 8px;
}
.label {
  color: var(--tilw-stage-secondary);
  font: 500 15px/1.36 var(--tilw-font-ar);
}
.code {
  inline-size: 100%;
  min-block-size: 64px;
  padding: 0 16px;
  border: 1px solid var(--tilw-stage-secondary);
  border-radius: 12px;
  background: var(--tilw-stage-surface);
  color: var(--tilw-stage-text);
  font: 700 32px/1 var(--tilw-font-latin, monospace);
  letter-spacing: 0.5em;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.code:focus-visible {
  outline: 2px solid var(--tilw-stage-cue);
  outline-offset: 2px;
}
.code.bad {
  border: 2px solid var(--tilw-status-error);
}
.error {
  margin: 0;
  color: #f0a59f;
  font: 500 16px/1.5 var(--tilw-font-ar);
}
.center {
  display: grid;
  justify-items: start;
  gap: 16px;
  padding-block-start: 64px;
}
.connected {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 16px;
}
.topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font: 500 15px/1.36 var(--tilw-font-ar);
}
.dot {
  inline-size: 8px;
  block-size: 8px;
  border-radius: 50%;
  background: var(--tilw-status-success);
}
.status.off {
  color: var(--tilw-stage-cue);
}
.status.off .dot {
  background: var(--tilw-stage-cue);
}
.offline {
  margin: 0;
  padding: 12px 16px;
  border: 1px solid var(--tilw-stage-cue);
  border-radius: 12px;
  background: var(--tilw-stage-surface);
  font: 400 15px/1.6 var(--tilw-font-ar);
}
.controls {
  flex: 1;
}
</style>
