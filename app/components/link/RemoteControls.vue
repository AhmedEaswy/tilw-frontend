<script setup lang="ts">
/**
 * Feature 004 (research R10, Figma L5 `278:273`, offline `278:331`): the phone's controls, shared by /remote and,
 * later, the studio when the Tilw app reads. Presentational: the studio's state in, commands out.
 * Large Play/Pause, Previous and Next for one-handed use; speed, text size, back to the start and record below.
 * Targets are at least 44×44; the result of the last command is announced politely.
 */
import type { CommandType, StudioState } from '~/services/types'
import type { CommandResult } from '~/services/link/remote'
import { FONT_STEPS } from '~/utils/reader'

const props = defineProps<{
  state: StudioState | null
  lastResult: CommandResult | null
  /** Studio offline or not connected: controls can't be used. */
  disabled: boolean
  previews: boolean
}>()
const emit = defineEmits<{ send: [type: CommandType, extra?: { paragraph?: number; wpm?: number }] }>()
const { t } = useI18n()
const nf = new Intl.NumberFormat('en')

const playing = computed(() => !!props.state?.playing)
const recording = computed(() => props.state?.recording.state ?? 'unavailable')
const isRecording = computed(() => recording.value === 'recording' || recording.value === 'countdown')
const sizeIdx = computed(() => (props.state ? FONT_STEPS.indexOf(props.state.fontSize) : -1))

const now = shallowRef(new Date())
useIntervalFn(() => (now.value = new Date()), 1000)
const elapsed = computed(() => {
  const at = props.state?.recording.startedAt
  if (recording.value !== 'recording' || !at) return null
  const s = Math.max(0, Math.floor((now.value.getTime() - new Date(at).getTime()) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
})

const resultText = computed(() => {
  const r = props.lastResult
  if (!r) return ''
  const command = t(`remote.commands.${r.type}`)
  switch (r.outcome) {
    case 'sending': return t('remote.result.sending', { command })
    case 'applied': return t('remote.result.applied', { command })
    case 'refused': return t(`remote.refused.${r.reason ?? 'unsupported'}`)
    default: return t('remote.result.notDelivered')
  }
})

const send = (type: CommandType, extra?: { paragraph?: number; wpm?: number }) => !props.disabled && emit('send', type, extra)
</script>

<template>
  <section class="rc" :class="{ off: disabled }" :aria-label="t('remote.pageTitle')">
    <div class="head">
      <h1 class="title" dir="auto">{{ state?.scriptTitle ?? t('remote.waitingState') }}</h1>
      <p v-if="state" class="meta">
        {{ t('remote.paragraphOf', { n: nf.format(state.paragraph + 1), total: nf.format(state.paragraphCount) }) }}
        · {{ t('remote.wpm', { n: nf.format(state.wpm) }) }}
        · {{ state.playing ? t('remote.playing') : t('remote.paused') }}
      </p>
    </div>

    <div v-if="state?.preview" class="preview">
      <p class="cur" dir="auto">{{ state.preview.current }}</p>
      <p v-if="state.preview.next" class="nxt" dir="auto">{{ state.preview.next }}</p>
    </div>
    <p v-else-if="state && !previews" class="nopreview">{{ t('remote.noPreview') }}</p>

    <p class="result" :class="lastResult?.outcome" aria-live="polite">
      <UiGlyph v-if="lastResult?.outcome === 'applied'" name="check" :size="18" />
      <span>{{ resultText }}</span>
    </p>

    <div class="spacer" />

    <div class="controls" :aria-disabled="disabled">
      <div class="transport">
        <button type="button" class="round" :aria-label="t('remote.commands.previous')" :disabled="disabled" @click="send('previous')">
          <UiGlyph name="prev" :size="26" />
        </button>
        <button
          type="button"
          class="round play"
          :aria-label="playing ? t('remote.commands.pause') : t('remote.commands.play')"
          :disabled="disabled"
          @click="send(playing ? 'pause' : 'play')"
        >
          <UiGlyph :name="playing ? 'pause' : 'play'" :size="36" />
        </button>
        <button type="button" class="round" :aria-label="t('remote.commands.next')" :disabled="disabled" @click="send('next')">
          <UiGlyph name="next" :size="26" />
        </button>
      </div>

      <div class="steps">
        <div class="step" role="group" :aria-label="t('remote.textSize')">
          <button type="button" :aria-label="t('remote.commands.textSmaller')" :disabled="disabled || sizeIdx <= 0" @click="send('textSmaller')">−</button>
          <span>{{ t('remote.textSize') }}</span>
          <button type="button" :aria-label="t('remote.commands.textBigger')" :disabled="disabled || sizeIdx >= FONT_STEPS.length - 1" @click="send('textBigger')">+</button>
        </div>
        <div class="step" role="group" :aria-label="t('remote.speed')">
          <button type="button" :aria-label="t('remote.commands.slower')" :disabled="disabled" @click="send('slower')">−</button>
          <span dir="ltr">{{ state ? nf.format(state.wpm) : '—' }}</span>
          <button type="button" :aria-label="t('remote.commands.faster')" :disabled="disabled" @click="send('faster')">+</button>
        </div>
      </div>

      <div class="extra">
        <button
          v-if="recording !== 'unavailable'"
          type="button"
          class="pill rec"
          :class="{ on: isRecording }"
          :disabled="disabled"
          @click="send(isRecording ? 'recordStop' : 'recordStart')"
        >
          <span class="recdot" aria-hidden="true" />
          {{ isRecording ? t('remote.commands.recordStop') : t('remote.commands.recordStart') }}
          <span v-if="elapsed" dir="ltr" class="time">{{ elapsed }}</span>
        </button>
        <button v-else type="button" class="pill" :disabled="disabled" @click="send('recordStart')">
          <span class="recdot" aria-hidden="true" />{{ t('remote.commands.recordStart') }}
        </button>
        <button type="button" class="pill" :disabled="disabled" @click="send('restart')">
          <UiGlyph name="rewind" :size="18" />{{ t('remote.commands.restart') }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.rc {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-block-size: 100%;
}
.head {
  display: grid;
  gap: 4px;
}
.title {
  margin: 0;
  overflow-wrap: anywhere;
  font: 700 24px/1.36 var(--tilw-font-ar);
}
.meta {
  margin: 0;
  color: var(--tilw-stage-secondary);
  font: 400 15px/1.5 var(--tilw-font-ar);
}
.preview {
  display: grid;
  gap: 8px;
  padding: 10px;
  border-radius: 18px;
  background: var(--tilw-stage-surface);
}
.preview p {
  margin: 0;
  padding: 12px 16px;
  font: 400 19px/1.55 var(--tilw-font-ar);
}
.cur {
  border-radius: 14px;
  background: color-mix(in srgb, var(--tilw-stage-text) 8%, transparent);
  color: var(--tilw-stage-text);
}
.nxt {
  color: var(--tilw-stage-secondary);
  font-size: 17px !important;
}
.nopreview {
  margin: 0;
  color: var(--tilw-stage-secondary);
  font: 400 15px/1.5 var(--tilw-font-ar);
}
.result {
  display: flex;
  align-items: center;
  gap: 8px;
  min-block-size: 24px;
  margin: 0;
  color: var(--tilw-stage-secondary);
  font: 500 15px/1.5 var(--tilw-font-ar);
}
.result.refused,
.result.notDelivered {
  color: var(--tilw-stage-cue);
}
.spacer {
  flex: 1;
}
.controls {
  display: grid;
  gap: 18px;
}
.off .controls {
  opacity: 0.4;
}
.transport {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 28px;
}
.round {
  display: inline-grid;
  place-items: center;
  inline-size: 64px;
  block-size: 64px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--tilw-stage-surface);
  color: var(--tilw-stage-text);
}
.round.play {
  inline-size: 96px;
  block-size: 96px;
  background: var(--tilw-stage-cue);
  color: var(--tilw-stage-surface);
}
.steps,
.extra {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.step {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 44px;
  align-items: center;
  min-block-size: 48px;
  border-radius: 12px;
  background: var(--tilw-surface-paper);
  color: var(--tilw-text-ink);
  text-align: center;
  font: 500 15px/1.2 var(--tilw-font-ar);
}
.step button {
  block-size: 48px;
  border: 0;
  background: none;
  color: inherit;
  font: 500 22px/1 var(--tilw-font-latin, sans-serif);
}
.pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-block-size: 48px;
  padding: 0 12px;
  border: 0;
  border-radius: 12px;
  background: var(--tilw-stage-surface);
  color: var(--tilw-stage-text);
  font: 500 16px/1.2 var(--tilw-font-ar);
}
.recdot {
  inline-size: 10px;
  block-size: 10px;
  border-radius: 50%;
  background: var(--tilw-stage-rec);
}
.rec.on {
  background: var(--tilw-stage-rec);
}
.rec.on .recdot {
  background: var(--tilw-stage-text);
}
.time {
  font-variant-numeric: tabular-nums;
}
button:focus-visible {
  outline: 2px solid var(--tilw-stage-cue);
  outline-offset: 2px;
}
button:disabled {
  cursor: not-allowed;
}
</style>
