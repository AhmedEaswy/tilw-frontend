<script setup lang="ts">
/**
 * Script history (R2-9 `262:954`) in the reading-settings drawer style (6:28): a side panel on desktop, a bottom sheet
 * on phones. Lists versions newest first (relative time, word count, reason), previews one read-only (the editor's
 * text stays unchanged), and restores it after confirming. A read-only script can view but not restore (US5 #4).
 */
import type { ScriptVersion, ScriptVersionSummary } from '~/services/types'

const props = defineProps<{ scriptId: string }>()
const emit = defineEmits<{ close: [] }>()
const { t, locale } = useI18n()
const editor = useEditorStore()
const plan = usePlanStore()
const upgrade = useUpgrade()
const limitError = useLimitError()
const errorText = useErrorText()
const { show } = useToast()
const titleId = useId()

const versions = ref<ScriptVersionSummary[] | null>(null)
const error = ref('')
const preview = ref<ScriptVersion | null>(null)
const previewing = ref<string | null>(null)
const confirming = ref(false)
const restoring = ref(false)
const panel = ref<HTMLElement>()

async function load() {
  error.value = ''
  try {
    versions.value = await useServices().scripts.listVersions(props.scriptId)
  } catch (e) {
    error.value = errorText(e)
  }
}
onMounted(() => {
  void load()
  nextTick(() => panel.value?.focus())
})
onKeyStroke('Escape', () => (confirming.value ? (confirming.value = false) : emit('close')))

async function open(v: ScriptVersionSummary) {
  previewing.value = v.id
  try {
    preview.value = await useServices().scripts.getVersion(props.scriptId, v.id)
  } catch (e) {
    show(errorText(e), 'error')
  } finally {
    previewing.value = null
  }
}

async function restore() {
  if (!preview.value) return
  restoring.value = true
  try {
    const s = await editor.restoreVersion(preview.value.id)
    confirming.value = false
    if (s) {
      show(t('history.restored'), 'success', 6000)
      emit('close')
    } else {
      emit('close') // conflict: the release-1 conflict screen takes over
    }
  } catch (e) {
    confirming.value = false
    if (!limitError.handle(e)) show(errorText(e), 'error')
  } finally {
    restoring.value = false
  }
}

const keepLine = computed(() => {
  const n = plan.limit('history.versions')
  const days = plan.limit('history.days')
  if (typeof n === 'number') return t('history.keepN', { n })
  if (typeof days === 'number') return t('history.keepDays', { n: days })
  return t('history.keepAll')
})
const paragraphs = computed(() => splitParagraphs(preview.value?.body ?? ''))
</script>

<template>
  <div class="scrim" aria-hidden="true" @click="emit('close')" />
  <section ref="panel" class="history" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1">
    <header>
      <button v-if="preview" type="button" class="back" @click="preview = null"><UiGlyph name="back" :size="20" />{{ t('history.list') }}</button>
      <h2 :id="titleId">{{ preview ? t('history.previewTitle') : t('history.title') }}</h2>
      <UiButton size="sm" tone="secondary" class="done" @click="emit('close')">{{ t('common.close') }}</UiButton>
    </header>

    <div class="scroll">
      <!-- preview -->
      <template v-if="preview">
        <span class="chip">{{ t('history.previewChip') }}</span>
        <p class="when">{{ relativeTime(preview.createdAt, locale) }} · {{ t(`history.reason.${preview.reason}`) }} · {{ preview.wordCount }} {{ unitFor(preview.wordCount, 'word', locale) }}</p>
        <article class="text" :dir="preview.direction === 'auto' ? 'auto' : preview.direction">
          <h3 dir="auto">{{ preview.title }}</h3>
          <p v-for="(para, i) in paragraphs" :key="i" dir="auto">{{ para }}</p>
        </article>
        <p v-if="editor.readOnly" class="ro">{{ t('history.readOnly') }}</p>
      </template>

      <!-- list -->
      <template v-else>
        <UiBanner v-if="error" tone="error">{{ error }}</UiBanner>
        <div v-else-if="!versions" class="skel" aria-busy="true"><UiSkeleton v-for="i in 3" :key="i" h="62px" r="8px" /></div>
        <p v-else-if="!versions.length" class="none">{{ t('history.none') }}</p>
        <ul v-else class="list">
          <li v-for="v in versions" :key="v.id">
            <button type="button" :aria-busy="previewing === v.id || undefined" @click="open(v)">
              <span class="v-main">
                <b>{{ relativeTime(v.createdAt, locale) }}</b>
                <small>{{ t(`history.reason.${v.reason}`) }} · {{ v.wordCount }} {{ unitFor(v.wordCount, 'word', locale) }}</small>
              </span>
              <UiGlyph name="arr" :size="16" />
            </button>
          </li>
        </ul>
        <p class="keep">{{ keepLine }}<template v-if="!plan.isPro && plan.my && upgrade.available.value"> <button type="button" class="link" @click="upgrade.open()">{{ t('history.morePro') }}</button></template></p>
      </template>
    </div>

    <footer v-if="preview">
      <UiButton block :disabled="editor.readOnly" @click="confirming = true">{{ t('history.restore') }}</UiButton>
    </footer>

    <UiDialog v-model:open="confirming" :title="t('history.confirmTitle')">
      <p>{{ t('history.confirmLede') }}</p>
      <template #actions>
        <UiButton :loading="restoring" @click="restore">{{ t('history.restore') }}</UiButton>
        <UiButton tone="secondary" @click="confirming = false">{{ t('library.back') }}</UiButton>
      </template>
    </UiDialog>
  </section>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: 30;
  background: var(--tilw-scrim);
}
.history {
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
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  padding: 24px 24px 16px;
  border-block-end: 1px solid var(--tilw-border-subtle);
}
h2 {
  margin: 0;
  font: 700 26px/1.36 var(--tilw-font-ar);
}
.back {
  display: inline-flex;
  flex-basis: 100%;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--tilw-action-primary);
  font: 500 15px/1.36 var(--tilw-font-ar);
  cursor: pointer;
}
.scroll {
  display: grid;
  align-content: start;
  gap: 14px;
  padding: 18px 24px 24px;
  overflow-y: auto;
}
.list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.list button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  inline-size: 100%;
  min-block-size: 62px;
  padding: 10px 16px;
  border: 0;
  border-radius: 8px;
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
  text-align: start;
  cursor: pointer;
}
.list button:hover {
  background: var(--tilw-surface-selected);
}
.list button:focus-visible,
.back:focus-visible,
.link:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
.v-main {
  display: grid;
  gap: 2px;
}
.v-main b {
  font: 500 17px/1.36 var(--tilw-font-ar);
}
.v-main small,
.when,
.keep,
.none,
.ro {
  color: var(--tilw-text-muted);
  font: 400 14px/1.5 var(--tilw-font-ar);
}
.when,
.keep,
.none,
.ro {
  margin: 0;
}
.link {
  margin-inline-start: 4px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--tilw-action-primary);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
}
.chip {
  justify-self: start;
  padding: 3px 12px;
  border-radius: 12px;
  background: var(--tilw-surface-selected);
  color: var(--tilw-action-primary);
  font: 500 13px/1.36 var(--tilw-font-ar);
}
.text {
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 10px;
  background: var(--tilw-surface-white);
}
.text h3 {
  margin: 0;
  font: 700 22px/1.4 var(--tilw-font-ar);
}
.text p {
  margin: 0;
  font: 400 17px/1.8 var(--tilw-font-ar);
  white-space: pre-wrap;
}
.skel {
  display: grid;
  gap: 8px;
}
footer {
  padding: 16px 24px calc(20px + env(safe-area-inset-bottom, 0px));
  border-block-start: 1px solid var(--tilw-border-subtle);
}
@media (max-width: 760px) {
  .history {
    inset-block: auto 0;
    inset-inline: 0;
    inline-size: 100%;
    block-size: min(700px, 88dvh);
    border-start-start-radius: 19px;
    border-start-end-radius: 19px;
    overflow: hidden;
  }
}
</style>
