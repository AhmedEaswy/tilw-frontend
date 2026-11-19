<script setup lang="ts">
/**
 * "Continue current script" card (6:18 desktop, 6:20 phone): photograph, "آخر نص فتحته", title,
 * a script monitor with the current paragraph and its position, then تدرب / إعداد التسجيل.
 */
import type { ScriptSummary } from '~/services/types'

const props = defineProps<{ script: ScriptSummary }>()
const { t, locale } = useI18n()

const total = computed(() => Math.max(1, props.script.paragraphCount))
const current = computed(() => Math.min(total.value, (props.script.lastPosition?.paragraph ?? 0) + 1))
// Figma writes the position with Arabic-Indic digits ("الفقرة ١ من ٣").
const fmt = (n: number) => new Intl.NumberFormat(locale.value === 'ar' ? 'ar-u-nu-arab' : 'en').format(n)
</script>

<template>
  <section class="card" :aria-labelledby="`lo-${script.id}`">
    <img class="photo" src="/media/glass.jpg" alt="" loading="lazy">
    <div class="head">
      <p class="kicker"><span class="cue" aria-hidden="true" />{{ t('library.lastOpened') }}</p>
      <h2 :id="`lo-${script.id}`" dir="auto">{{ script.title }}</h2>
    </div>
    <div class="monitor">
      <p class="line" dir="auto">{{ script.excerpt }}</p>
      <div class="pos">
        <span>{{ t('library.paragraphOf', { n: fmt(current), total: fmt(total) }) }}</span>
        <span class="bars" aria-hidden="true">
          <i v-for="i in Math.min(total, 6)" :key="i" :class="{ on: i === Math.min(current, 6) }" />
        </span>
      </div>
      <UiButton class="rehearse-phone" tone="cue" :to="`/app/scripts/${script.id}/rehearse`">{{ t('library.rehearse') }}</UiButton>
    </div>
    <div class="acts">
      <UiButton tone="cue" :to="`/app/scripts/${script.id}/rehearse`">{{ t('library.rehearse') }}</UiButton>
      <UiButton tone="dark" :to="`/app/scripts/${script.id}/record`">{{ t('library.setupRecording') }}</UiButton>
    </div>
  </section>
</template>

<style scoped>
.card {
  display: grid;
  gap: 0;
  padding: 13px;
  border: 1px solid var(--tilw-border-strong);
  border-radius: var(--tilw-radius-card);
  background: var(--tilw-stage-background);
  color: var(--tilw-stage-text);
}
.photo {
  inline-size: 100%;
  block-size: 166px;
  object-fit: cover;
  border-radius: 9px;
}
.head {
  padding: 14px 16px 10px;
}
.kicker {
  display: flex;
  align-items: center;
  gap: 8px;
  font: 500 15px/22px var(--tilw-font-ar);
  color: var(--tilw-stage-secondary);
}
.cue {
  inline-size: 10px;
  block-size: 3px;
  border-radius: 1px;
  background: var(--tilw-stage-cue);
}
h2 {
  margin-block-start: 6px;
  font: 700 40px/56px var(--tilw-font-ar);
  overflow-wrap: anywhere;
}
.monitor {
  display: grid;
  gap: 12px;
  padding: 12px 14px 14px;
  border: 1px solid var(--tilw-stage-secondary);
  border-radius: 9px;
  background: var(--tilw-stage-surface);
}
.line {
  font: 400 21px/31px var(--tilw-font-ar);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.pos {
  display: grid;
  gap: 8px;
  font: 500 13px/20px var(--tilw-font-ar);
  color: var(--tilw-stage-secondary);
}
.bars {
  display: flex;
  gap: 5px;
}
.bars i {
  flex: 1;
  block-size: 2px;
  border-radius: 1px;
  background: var(--tilw-stage-secondary);
}
.bars i.on {
  block-size: 4px;
  margin-block-start: -1px;
  background: var(--tilw-stage-cue);
}
.rehearse-phone {
  display: none;
}
.acts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  padding: 26px 14px 10px;
}
.acts :deep(.t-dark) {
  background: transparent;
}
.acts :deep(.t-dark:hover) {
  background: var(--tilw-stage-surface);
}

/* Phone (6:20): photo beside the title, rehearse inside the monitor, no recording button. */
@media (max-width: 760px) {
  .card {
    grid-template-columns: 1fr 93px;
    gap: 12px;
    padding: 12px;
  }
  .photo {
    grid-column: 2;
    grid-row: 1;
    block-size: 100px;
  }
  .head {
    grid-column: 1;
    grid-row: 1;
    padding: 4px 4px 0;
  }
  h2 {
    font-size: 26px;
    line-height: 38px;
  }
  .monitor {
    grid-column: 1 / -1;
    grid-template-columns: 1fr auto;
    align-items: end;
  }
  .line {
    grid-column: 1 / -1;
    font-size: 18px;
    line-height: 27px;
  }
  .pos {
    grid-column: 1;
    grid-row: 2;
  }
  .rehearse-phone {
    display: inline-flex;
    grid-column: 2;
    grid-row: 2;
  }
  .acts {
    display: none;
  }
}
</style>
