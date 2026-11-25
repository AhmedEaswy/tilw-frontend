<script setup lang="ts">
/**
 * All library dialogs in one place, driven by `mode`:
 *  new (6:23) · import (6:24) · sort (6:25) · rename (6:109) · download (6:110)
 * A script's options (6:108) are a dropdown menu on its row (ScriptRow); rename and download open from there.
 * The parent sets `mode` (and `target` for per-script dialogs); this component does the work.
 */
import type { ScriptSummary } from '~/services/types'
import type { ScriptSort } from '~/stores/scripts'

export type LibraryDialog = 'new' | 'import' | 'sort' | 'rename' | 'download' | null

const mode = defineModel<LibraryDialog>('mode', { required: true })
const props = defineProps<{ target: ScriptSummary | null }>()

const { t } = useI18n()
const store = useScriptsStore()
const { show } = useToast()
const errorText = useErrorText()
const limitError = useLimitError()
/** Release 2: a refusal over a plan limit closes this dialog and opens the limit dialog (R2-2). */
function failed(e: unknown) {
  if (limitError.handle(e)) {
    mode.value = null
    return
  }
  formError.value = errorText(e)
}

const open = computed({
  get: () => mode.value !== null,
  set: (v) => {
    if (!v) mode.value = null
  },
})
const busy = ref(false)
const fieldError = ref<string>()
const formError = ref<string>()
const title = ref('')
const sortChoice = ref<ScriptSort>('recent')
const fileInput = ref<HTMLInputElement>()

watch(mode, (m) => {
  fieldError.value = undefined
  formError.value = undefined
  busy.value = false
  if (m === 'new') title.value = ''
  if (m === 'rename') title.value = props.target?.title ?? ''
  if (m === 'sort') sortChoice.value = store.sort
})

const dialogTitle = computed(() => {
  switch (mode.value) {
    case 'new': return t('library.new')
    case 'import': return t('library.importTitle')
    case 'sort': return t('library.sortTitle')
    case 'rename': return t('library.rename')
    case 'download': return t('library.downloadTitle')
    default: return ''
  }
})

function validTitle() {
  const v = title.value.trim()
  fieldError.value = !v ? t('library.titleRequired') : v.length > 120 ? t('library.titleTooLong') : undefined
  return !fieldError.value
}

async function createScript() {
  if (busy.value || !validTitle()) return
  busy.value = true
  try {
    const s = await store.create(title.value.trim())
    mode.value = null
    await navigateTo(`/app/scripts/${s.id}`)
  } catch (e) {
    failed(e)
  } finally {
    busy.value = false
  }
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  formError.value = undefined
  const r = await readTextFile(file)
  if ('error' in r) {
    formError.value = t(`library.importError.${r.error}`)
    return
  }
  busy.value = true
  try {
    const s = await store.create(r.title.slice(0, 120), r.body)
    mode.value = null
    show(t('library.imported', { title: s.title }))
    await navigateTo(`/app/scripts/${s.id}`)
  } catch (err) {
    failed(err)
  } finally {
    busy.value = false
  }
}

function applySort() {
  store.sort = sortChoice.value
  mode.value = null
}

async function renameScript() {
  if (!props.target || busy.value || !validTitle()) return
  busy.value = true
  try {
    await store.rename(props.target.id, title.value)
    mode.value = null
    show(t('library.renamed'))
  } catch (e) {
    failed(e)
  } finally {
    busy.value = false
  }
}

async function downloadScript() {
  if (!props.target || busy.value) return
  busy.value = true
  try {
    const s = await useServices().scripts.get(props.target.id)
    downloadText(s.title, s.body)
    mode.value = null
    show(t('library.downloaded'))
  } catch (e) {
    formError.value = errorText(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiDialog v-model:open="open" :title="dialogTitle">
    <UiBanner v-if="formError" tone="error">{{ formError }}</UiBanner>

    <!-- 6:23 نص جديد -->
    <form v-if="mode === 'new'" id="lib-new" class="form" novalidate @submit.prevent="createScript">
      <UiField v-model="title" :label="t('library.titleLabel')" :placeholder="t('library.titlePlaceholder')" :maxlength="120" :error="fieldError" autofocus />
    </form>

    <!-- 6:24 استيراد نص -->
    <template v-else-if="mode === 'import'">
      <p>{{ t('library.importLede') }}</p>
      <p class="hint">{{ t('library.importHint') }}</p>
      <input ref="fileInput" type="file" accept=".txt,text/plain" hidden @change="onFile">
    </template>

    <!-- 6:25 ترتيب النصوص -->
    <div v-else-if="mode === 'sort'" class="options" role="radiogroup" :aria-label="t('library.sortTitle')">
      <label v-for="o in (['recent', 'title'] as const)" :key="o" class="opt" :class="{ on: sortChoice === o }">
        <input v-model="sortChoice" type="radio" name="sort" :value="o">
        <span class="radio" aria-hidden="true" />
        {{ t(`library.sort.${o}`) }}
      </label>
    </div>

    <!-- 6:109 تغيير العنوان -->
    <form v-else-if="mode === 'rename'" id="lib-rename" class="form" novalidate @submit.prevent="renameScript">
      <UiField v-model="title" :label="t('library.titleLabel')" :maxlength="120" :error="fieldError" autofocus />
    </form>

    <!-- 6:110 تنزيل النص -->
    <template v-else-if="mode === 'download' && target">
      <div class="file">
        <UiGlyph name="file" :size="20" />
        <span><b dir="auto">{{ target.title }}</b><small class="ltr">TXT</small></span>
      </div>
      <p>{{ t('library.downloadLede') }}</p>
    </template>

    <template #actions>
      <template v-if="mode === 'new'">
        <UiButton type="submit" form="lib-new" :loading="busy">{{ t('library.openEditor') }}</UiButton>
        <UiButton tone="secondary" @click="mode = null">{{ t('library.back') }}</UiButton>
      </template>
      <template v-else-if="mode === 'import'">
        <UiButton :loading="busy" @click="fileInput?.click()">{{ t('library.chooseTxt') }}</UiButton>
        <UiButton tone="secondary" @click="mode = null">{{ t('library.back') }}</UiButton>
      </template>
      <template v-else-if="mode === 'sort'">
        <UiButton @click="applySort">{{ t('library.done') }}</UiButton>
        <UiButton tone="secondary" @click="mode = null">{{ t('library.back') }}</UiButton>
      </template>
      <template v-else-if="mode === 'rename'">
        <UiButton type="submit" form="lib-rename" :loading="busy">{{ t('common.save') }}</UiButton>
        <UiButton tone="secondary" @click="mode = null">{{ t('library.back') }}</UiButton>
      </template>
      <template v-else-if="mode === 'download'">
        <UiButton :loading="busy" icon="download" @click="downloadScript">{{ t('library.downloadTxtFile') }}</UiButton>
        <UiButton tone="secondary" @click="mode = null">{{ t('library.back') }}</UiButton>
      </template>
    </template>
  </UiDialog>
</template>

<style scoped>
.form :deep(.box) {
  block-size: 64px;
  border: 0;
  border-radius: 9px;
}
.form :deep(input) {
  font: 400 20px/1.36 var(--tilw-font-ar);
}
.form :deep(label) {
  font: 400 22px/1.36 var(--tilw-font-ar);
  color: var(--tilw-text-muted);
}
.hint {
  font-size: 15px;
}
.options {
  display: grid;
  gap: 16px;
}
.opt {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-block-size: 62px;
  padding-inline: 20px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: 8px;
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
  font: 500 19px/29px var(--tilw-font-ar);
  cursor: pointer;
}
.opt.on {
  border-color: var(--tilw-action-primary);
  background: var(--tilw-surface-selected);
}
.opt input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.opt:has(input:focus-visible) {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
.radio {
  display: grid;
  place-items: center;
  inline-size: 20px;
  block-size: 20px;
  border: 1.5px solid var(--tilw-text-muted);
  border-radius: 50%;
}
.opt.on .radio::after {
  content: '';
  inline-size: 10px;
  block-size: 10px;
  border-radius: 50%;
  background: var(--tilw-action-primary);
}.file {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 9px;
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
}
.file > span:not(.ui-glyph) {
  display: grid;
}
.file b {
  font: 500 17px/1.4 var(--tilw-font-ar);
}
.file small {
  font: 400 13px/1.4 var(--tilw-font-lat);
  color: var(--tilw-text-muted);
  text-align: start;
}
</style>
