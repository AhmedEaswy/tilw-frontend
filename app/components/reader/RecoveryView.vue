<script setup lang="ts">
/**
 * Reader recovery (T065). 6:79: the reading position couldn't be saved — the prompter stays paused with a
 * notice, the user resumes from here or picks a paragraph. 6:80: "اختر فقرة" lists the paragraphs with the
 * current one selected. Deviation: 6:80 is drawn inside the app navigation; the reader has none, so the
 * card sits on the paper surface on its own (gaps.md).
 */
const props = defineProps<{ title: string; paragraphs: string[]; current: number }>()
const emit = defineEmits<{ resume: []; choose: [i: number]; close: [] }>()
const view = defineModel<'notice' | 'choose'>('view', { default: 'notice' })
const { t } = useI18n()
// The reader frames use Western digits in both languages ("الفقرة 2 من 3", "120 كلمة/د").
const nf = computed(() => new Intl.NumberFormat('en'))

const resumeBtn = ref<{ $el: HTMLElement }>()
const list = ref<HTMLElement>()
watch(view, v => nextTick(() => {
  if (v === 'choose') list.value?.querySelector<HTMLElement>('[aria-current="true"]')?.focus()
  else resumeBtn.value?.$el.focus()
}), { immediate: true })

const prevLine = computed(() => (props.current > 0 ? props.paragraphs[props.current - 1] : ''))
const line = computed(() => props.paragraphs[props.current] ?? '')
const short = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
</script>

<template>
  <div v-if="view === 'notice'" class="notice-view" role="alertdialog" aria-labelledby="rec-title" aria-describedby="rec-lede" data-reader-panel>
    <header>
      <p class="name">{{ title }}</p>
      <button type="button" class="link close" @click="emit('close')">{{ t('reader.recovery.close') }}</button>
    </header>
    <div class="notice">
      <div>
        <h2 id="rec-title">{{ t('reader.recovery.title') }}</h2>
        <p id="rec-lede">{{ t('reader.recovery.lede') }}</p>
      </div>
      <button type="button" class="link choose" @click="view = 'choose'">{{ t('reader.recovery.choose') }}</button>
    </div>
    <div class="lines" dir="auto">
      <p v-if="prevLine" class="dim">{{ short(prevLine, 60) }}</p>
      <p class="lit">{{ short(line, 70) }}</p>
    </div>
    <UiButton ref="resumeBtn" tone="cue" class="resume" @click="emit('resume')">{{ t('reader.recovery.resume') }}</UiButton>
  </div>

  <div v-else class="choose-view" data-reader-panel>
    <section class="card" role="dialog" aria-labelledby="choose-title">
      <p class="kicker">{{ t('reader.recovery.kicker') }}</p>
      <h2 id="choose-title">{{ t('reader.recovery.chooseTitle') }}</h2>
      <p class="sub">{{ title }}</p>
      <ol ref="list">
        <li v-for="(p, i) in paragraphs" :key="i">
          <button type="button" :aria-current="i === current ? 'true' : undefined" @click="emit('choose', i)">
            <span class="n">{{ nf.format(i + 1) }}</span>
            <span class="txt" dir="auto">{{ short(p) }}</span>
          </button>
        </li>
      </ol>
      <button type="button" class="link cancel" @click="view = 'notice'">{{ t('reader.recovery.cancel') }}</button>
    </section>
  </div>
</template>

<style scoped>
.link {
  padding: 0;
  border: 0;
  background: none;
  font: 500 17px/1.36 var(--tilw-font-ar);
}
.link:hover {
  text-decoration: underline;
}
.link:focus-visible,
li button:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}

/* 6:79 */
.notice-view {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px max(24px, env(safe-area-inset-left, 0px)) 40px;
  overflow-y: auto;
  background: var(--tilw-stage-background);
  color: var(--tilw-stage-text);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  inline-size: min(1010px, 100%);
}
.name {
  margin: 0;
  font: 500 21px/1.36 var(--tilw-font-ar);
}
.close {
  color: var(--tilw-stage-secondary);
}
.notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  inline-size: min(908px, 100%);
  margin-block-start: 50px;
  padding: 14px 28px 18px 18px;
  border-radius: 12px;
  background: var(--tilw-surface-paper);
  color: var(--tilw-text-ink);
}
.notice h2 {
  margin: 0;
  font: 500 18px/1.36 var(--tilw-font-ar);
}
.notice p {
  margin: 8px 0 0;
  color: var(--tilw-text-muted);
  font: 400 16px/1.36 var(--tilw-font-ar);
}
.choose {
  flex: 0 0 auto;
  color: var(--tilw-action-primary);
  font-size: 18px;
}
.lines {
  display: grid;
  gap: 24px;
  inline-size: min(948px, 100%);
  margin-block: 66px 0;
  text-align: center;
}
.lines p {
  margin: 0;
  font: 400 48px/1.36 var(--tilw-font-ar);
}
.lines .dim {
  color: var(--tilw-stage-secondary);
}
.lines .lit {
  font-size: 51px;
}
.resume {
  inline-size: 274px;
  margin-block-start: clamp(48px, 18dvh, 170px);
}

/* 6:80 */
.choose-view {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: start center;
  padding: 70px 16px 40px;
  overflow-y: auto;
  background: var(--tilw-surface-paper);
  color: var(--tilw-text-ink);
}
.card {
  inline-size: min(628px, 100%);
  padding: 32px 40px 48px 42px;
  border-radius: 16px;
  background: var(--tilw-surface-white);
}
.kicker {
  margin: 0;
  color: var(--tilw-action-primary);
  font: 500 16px/1.36 var(--tilw-font-ar);
}
.card h2 {
  margin: 32px 0 0;
  font: 700 34px/1.36 var(--tilw-font-ar);
}
.sub {
  margin: 22px 0 0;
  color: var(--tilw-text-muted);
  font: 400 19px/1.52 var(--tilw-font-ar);
}
ol {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  margin: 26px 0 0;
  padding: 0;
  list-style: none;
}
li button {
  display: flex;
  align-items: center;
  gap: 16px;
  inline-size: 100%;
  min-block-size: 52px;
  padding-inline: 18px 24px;
  border: 0;
  border-radius: 7px;
  background: var(--tilw-surface-paper);
  color: var(--tilw-text-ink);
  font: 400 17px/1.36 var(--tilw-font-ar);
  text-align: start;
}
li button:hover {
  background: var(--tilw-surface-quiet);
}
li button[aria-current='true'] {
  background: var(--tilw-surface-selected);
}
.n {
  flex: 0 0 46px;
  color: var(--tilw-text-muted);
  font: 500 17px/1.36 var(--tilw-font-lat);
  text-align: center;
}
.txt {
  flex: 1;
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cancel {
  margin-block-start: 30px;
  color: var(--tilw-action-primary);
  font-size: 16px;
}

@media (max-width: 760px) {
  .notice {
    flex-direction: column;
    align-items: start;
    margin-block-start: 28px;
    padding: 16px 18px;
  }
  .lines p {
    font-size: 26px;
  }
  .lines .lit {
    font-size: 30px;
  }
  .resume {
    inline-size: 100%;
  }
  .card {
    padding: 24px 20px 32px;
  }
  .card h2 {
    margin-block-start: 16px;
    font-size: 28px;
  }
}
</style>
