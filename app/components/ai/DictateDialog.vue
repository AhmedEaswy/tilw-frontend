<script setup lang="ts">
/**
 * Feature 005, US3 on the device (gaps G-A5, frame A3): the browser's own speech recognition turns speech into text
 * while the person talks. No AI service, no credits, and Tilw receives no audio. The microphone is asked for (by the
 * browser) when the dialog opens from the Dictate action, never before. Stop, then Insert hands the text to the
 * editor, which inserts it at the cursor as one undo step.
 */
import { DICTATION_LANGS, DICTATION_LANG_KEY, dictationLang, type DictationLang } from '~/services/ai/recognition'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ direction: 'rtl' | 'ltr' }>()
const emit = defineEmits<{ insert: [text: string] }>()
const { t } = useI18n()

function saved(): string | null {
  try {
    return localStorage.getItem(DICTATION_LANG_KEY)
  } catch {
    return null
  }
}
const lang = ref<DictationLang>(dictationLang(props.direction, import.meta.client ? saved() : null))
const langOptions = computed(() => DICTATION_LANGS.map(v => ({ value: v, label: t(`ai.dictate.langs.${v}`) })))
watch(lang, (v) => {
  try {
    localStorage.setItem(DICTATION_LANG_KEY, v)
  } catch {
    // Private mode: the choice lasts for this dialog only.
  }
  dictation.setLang(v)
})

const dictation = useDictation()
const state = dictation.state
const listening = computed(() => state.value === 'listening' || state.value === 'starting')

function insert() {
  const text = dictation.text.value.trim()
  if (text) emit('insert', text)
  close()
}
function again() {
  dictation.start(lang.value)
}
function close() {
  dictation.cancel()
  open.value = false
}

watch(open, (v) => {
  if (v) dictation.start(lang.value)
  else dictation.cancel()
}, { immediate: true })

const problem = computed(() => {
  switch (state.value) {
    case 'denied': return { title: t('ai.speech.micDeniedTitle'), text: t('ai.dictate.denied') }
    case 'missing': return { title: t('ai.speech.micMissing'), text: undefined }
    case 'offline': return { title: t('ai.dictate.offlineTitle'), text: t('ai.dictate.offline') }
    case 'unavailable': return { title: t('ai.dictate.unavailableTitle'), text: t('ai.dictate.unavailable') }
    default: return null
  }
})
</script>

<template>
  <UiDialog v-model:open="open" :title="t('ai.speech.dictateTitle')" data-testid="dictate-dialog" @close="close">
    <div class="dd">
      <div class="lang">
        <label for="dictate-lang">{{ t('ai.dictate.lang') }}</label>
        <UiSelect id="dictate-lang" v-model="lang" :options="langOptions" size="sm" data-testid="dictate-lang" />
      </div>
      <AiMessage v-if="problem" :title="problem.title" :text="problem.text" tone="error" />
      <template v-else>
        <p v-if="listening" class="live" data-testid="dictate-listening">
          <i aria-hidden="true" />{{ state === 'starting' ? t('ai.speech.starting') : t('ai.dictate.listening') }}
        </p>
        <div class="said" :dir="direction" aria-live="polite" data-testid="dictate-text">
          <span v-if="dictation.finalText.value">{{ dictation.finalText.value }}</span>
          <span v-if="dictation.liveText.value" class="interim"> {{ dictation.liveText.value }}</span>
          <span v-if="!dictation.text.value" class="placeholder">{{ listening ? t('ai.dictate.speakNow') : t('ai.dictate.nothing') }}</span>
        </div>
      </template>
      <p class="privacy">{{ t('ai.dictate.privacy') }}</p>
    </div>
    <template #actions>
      <UiButton v-if="listening" icon="stop" data-testid="dictate-stop" @click="dictation.stop()">{{ t('ai.speech.stop') }}</UiButton>
      <UiButton v-else-if="state === 'done' && dictation.text.value" data-testid="dictate-insert" @click="insert">{{ t('ai.dictate.insert') }}</UiButton>
      <UiButton v-if="!listening && state !== 'unavailable'" tone="secondary" data-testid="dictate-again" @click="again">{{ t('ai.dictate.again') }}</UiButton>
      <UiButton tone="secondary" @click="close">{{ state === 'done' && dictation.text.value ? t('ai.dictate.discard') : t('ai.common.cancel') }}</UiButton>
    </template>
  </UiDialog>
</template>

<style scoped>
.dd {
  display: grid;
  gap: 14px;
}
.lang {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font: 500 14px/1.4 var(--tilw-font-ar);
}
.live {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tilw-status-error);
  font: 500 15px/1.4 var(--tilw-font-ar);
}
.live i {
  inline-size: 10px;
  block-size: 10px;
  border-radius: 50%;
  background: currentColor;
}
.said {
  min-block-size: 96px;
  max-block-size: 40vh;
  overflow-y: auto;
  padding: 12px 14px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: 8px;
  font: 400 17px/1.8 var(--tilw-font-ar);
  white-space: pre-wrap;
}
.interim,
.placeholder {
  color: var(--tilw-text-muted);
}
.privacy {
  margin: 0;
  color: var(--tilw-text-muted);
  font: 400 13px/1.6 var(--tilw-font-ar);
}
</style>
