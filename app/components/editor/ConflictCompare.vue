<script setup lang="ts">
/**
 * "Script conflict · compare source copies" (6:72) and "confirm replacement" (6:73).
 * Shown when the account copy changed somewhere else while this device had unsaved edits.
 * Choices: save my edits as a new script, use the account copy (after confirming), or go back.
 */
const props = defineProps<{ mine: { title: string; body: string }; theirs: { title: string; body: string } }>()
const emit = defineEmits<{ saveMine: []; useTheirs: []; back: [] }>()
const { t } = useI18n()
const confirming = ref(false)
const busy = defineModel<boolean>('busy', { default: false })

/** Show the first paragraph that differs, so the difference is visible at a glance (as in 6:72). */
const diff = computed(() => {
  const a = splitParagraphs(props.mine.body)
  const b = splitParagraphs(props.theirs.body)
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return { mine: a[i] ?? '', theirs: b[i] ?? '', index: i }
  return { mine: a[0] ?? '', theirs: b[0] ?? '', index: 0 }
})
const titleDiffers = computed(() => props.mine.title !== props.theirs.title)
</script>

<template>
  <section v-if="!confirming" class="compare">
    <h1>{{ t('editor.conflict.title') }}</h1>
    <p class="lede">{{ t('editor.conflict.lede') }}</p>
    <div class="copies">
      <article class="copy mine">
        <h2>{{ t('editor.conflict.mine') }}</h2>
        <p class="where">{{ t('editor.conflict.mineWhere') }}</p>
        <p v-if="titleDiffers" class="t" dir="auto">{{ mine.title }}</p>
        <p class="txt" dir="auto">{{ diff.mine || '—' }}</p>
      </article>
      <article class="copy theirs">
        <h2>{{ t('editor.conflict.theirs') }}</h2>
        <p class="where">{{ t('editor.conflict.theirsWhere') }}</p>
        <p v-if="titleDiffers" class="t" dir="auto">{{ theirs.title }}</p>
        <p class="txt" dir="auto">{{ diff.theirs || '—' }}</p>
      </article>
    </div>
    <p v-if="diff.index > 0" class="where">{{ t('editor.conflict.paragraph', { n: diff.index + 1 }) }}</p>
    <div class="acts">
      <UiButton :loading="busy" @click="emit('saveMine')">{{ t('editor.conflict.saveMine') }}</UiButton>
      <UiButton tone="secondary" :disabled="busy" @click="confirming = true">{{ t('editor.conflict.useTheirs') }}</UiButton>
      <button type="button" class="back" @click="emit('back')">{{ t('editor.conflict.back') }}</button>
    </div>
  </section>

  <section v-else class="confirm" role="alertdialog" aria-labelledby="cf-t" aria-describedby="cf-d">
    <p class="kicker">{{ t('editor.conflict.review') }}</p>
    <h1 id="cf-t">{{ t('editor.conflict.confirmTitle') }}</h1>
    <p id="cf-d" class="lede">{{ t('editor.conflict.confirmLede') }}</p>
    <div class="acts">
      <UiButton @click="emit('useTheirs')">{{ t('editor.conflict.useTheirs') }}</UiButton>
      <UiButton tone="secondary" @click="confirming = false">{{ t('common.back') }}</UiButton>
    </div>
  </section>
</template>

<style scoped>
.compare {
  display: grid;
  gap: 0;
  padding-block: 37px 40px;
}
h1 {
  font: 700 41px/1.36 var(--tilw-font-ar);
}
.lede {
  margin-block: 12px 56px;
  font: 400 18px/1.36 var(--tilw-font-ar);
  color: var(--tilw-text-muted);
}
.copies {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}
.copy {
  display: grid;
  align-content: start;
  min-block-size: 244px;
  padding: 24px 23px;
  border-radius: 12px;
  background: var(--tilw-surface-white);
}
.copy.mine {
  background: var(--tilw-surface-selected);
}
.copy h2 {
  font: 500 23px/1.36 var(--tilw-font-ar);
}
.where {
  margin-block: 16px 0;
  font: 400 15px/1.36 var(--tilw-font-ar);
  color: var(--tilw-text-muted);
}
.copy .where {
  padding-block-end: 22px;
  border-block-end: 1px solid var(--tilw-border-subtle);
}
.t {
  margin-block-start: 18px;
  font: 700 19px/1.4 var(--tilw-font-ar);
}
.txt {
  margin-block-start: 22px;
  font: 400 21px/1.48 var(--tilw-font-ar);
  white-space: pre-wrap;
}
.acts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 22px;
  margin-block-start: 43px;
}
.acts :deep(.t-primary) {
  min-inline-size: 280px;
}
.acts :deep(.t-secondary) {
  min-inline-size: 236px;
}
.back {
  margin-inline-start: auto;
  border: 0;
  background: none;
  color: var(--tilw-action-primary);
  font: 500 16px/1.36 var(--tilw-font-ar);
}
.back:hover {
  text-decoration: underline;
}
.confirm {
  display: grid;
  max-inline-size: 628px;
  margin: 70px auto 0;
  padding: 32px 40px 70px;
  border-radius: 16px;
  background: var(--tilw-surface-white);
}
.kicker {
  font: 500 16px/1.36 var(--tilw-font-ar);
  color: var(--tilw-action-primary);
}
.confirm h1 {
  margin-block-start: 32px;
  font-size: 34px;
}
.confirm .lede {
  margin-block: 22px 0;
  font-size: 19px;
  line-height: 1.52;
}
.confirm .acts {
  justify-content: space-between;
  margin-block-start: 140px;
}
.confirm .acts :deep(.t-secondary) {
  min-inline-size: 175px;
}

@media (max-width: 760px) {
  h1 { font-size: 30px; }
  .lede { margin-block-end: 28px; }
  .copies { grid-template-columns: 1fr; gap: 10px; }
  .acts { flex-direction: column; align-items: stretch; }
  .acts :deep(.ui-btn) { min-inline-size: 0; }
  .back { margin-inline-start: 0; padding: 10px; }
  .confirm { margin-block-start: 24px; padding: 24px 20px; }
  .confirm .acts { margin-block-start: 48px; }
}
</style>
