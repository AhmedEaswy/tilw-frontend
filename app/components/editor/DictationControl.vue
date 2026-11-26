<script setup lang="ts">
/**
 * Feature 005 (gaps G-A7): the small square microphone in the editor's footer. Pressing it starts dictation, with
 * the Record setup page's soundbar beside it showing the voice while listening; pressing again stops. The words wait gray in the
 * editor until Enter (or the check button, for phones) adds them; Esc (or the cross) throws them away.
 */
import type { DictationLang } from '~/services/ai/recognition'

defineProps<{
  /** Dictation can run here (the plan's speech to text, or the browser's own recognition). */
  supported: boolean
  readOnly?: boolean
  listening: boolean
  finishing: boolean
  /** Microphone level, 0..1, for the soundbar. */
  level: number
  /** Words are waiting to be confirmed. */
  hasText: boolean
  /** The provider writes the text, for credits. */
  cloud: boolean
  langOptions: { value: DictationLang; label: string }[]
}>()
const lang = defineModel<DictationLang>('lang', { required: true })
const emit = defineEmits<{ toggle: []; confirm: []; discard: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="dict" data-testid="dictation">
    <UiTooltip v-if="!supported" v-slot="{ describedby }" :text="t('ai.dictate.unsupported')">
      <button type="button" class="sq off" aria-disabled="true" :aria-label="t('ai.tools.dictate')" :aria-describedby="describedby" data-testid="dictate-mic">
        <UiGlyph name="mic" :size="16" />
      </button>
    </UiTooltip>
    <template v-else>
      <button
        type="button"
        class="sq mic"
        :disabled="readOnly || finishing"
        :aria-pressed="listening"
        :aria-label="listening ? t('ai.speech.stop') : t('ai.tools.dictate')"
        :title="listening ? t('ai.speech.stop') : t(cloud ? 'ai.tools.dictateRecordHint' : 'ai.dictate.privacy')"
        data-dictation-enter
        data-testid="dictate-mic"
        @click="emit('toggle')"
      >
        <UiGlyph :name="listening ? 'stop' : 'mic'" :size="16" />
      </button>
      <span v-if="listening" class="bar" data-testid="dictate-level"><LevelMeter :level="level" /></span>
      <template v-if="listening || finishing || hasText">
        <button type="button" class="sq" :disabled="!hasText || finishing" :aria-label="t('ai.dictate.insert')" :title="t('ai.dictate.insert')" data-testid="dictate-insert" @click="emit('confirm')">
          <UiGlyph name="check" :size="16" />
        </button>
        <button type="button" class="sq" :aria-label="t('ai.dictate.discard')" :title="t('ai.dictate.discard')" data-testid="dictate-discard" @click="emit('discard')">
          <UiGlyph name="close" :size="16" />
        </button>
        <UiSelect v-model="lang" class="lang" :options="langOptions" :disabled="cloud && listening" size="sm" :label="t('ai.dictate.lang')" data-testid="dictate-lang" />
      </template>
    </template>
    <p class="status" role="status" data-testid="dictate-status">
      <template v-if="finishing">{{ t('ai.speech.working') }}</template>
      <template v-else-if="listening">{{ t(cloud ? 'ai.dictate.listeningCloud' : 'ai.dictate.listeningHint') }}</template>
      <template v-else-if="hasText">{{ t('ai.dictate.pendingHint') }}</template>
    </p>
  </div>
</template>

<style scoped>
.dict {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-inline-size: 0;
}
.sq {
  display: inline-grid;
  place-items: center;
  inline-size: 28px;
  block-size: 28px;
  padding: 0;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: 6px;
  background: var(--tilw-surface-white);
  color: var(--tilw-action-primary);
  cursor: pointer;
}
.sq:hover:not(:disabled) {
  background: var(--tilw-surface-selected);
}
.sq:disabled,
.sq.off {
  color: var(--tilw-text-muted);
  cursor: default;
}
.mic[aria-pressed='true'],
.mic[aria-pressed='true']:hover:not(:disabled) {
  border-color: var(--tilw-action-primary);
  background: var(--tilw-action-primary);
  color: var(--tilw-surface-white);
}
/* The meter's unlit segments are drawn for a dark strip, as on the Record page. */
.bar {
  display: inline-flex;
  align-items: center;
  block-size: 28px;
  padding-inline: 8px;
  border-radius: 6px;
  background: var(--tilw-stage-surface);
}
.lang {
  inline-size: auto;
}
.status {
  margin: 0;
  font: 400 13px/1.5 var(--tilw-font-ar);
  color: var(--tilw-text-muted);
}
</style>
