<script setup lang="ts">
/**
 * Delivery marks — "علامات الإلقاء" (6:19 tool). No Figma frame for the panel itself (G7). Marks are added
 * from the toolbar over the selected words (MarksToolbar); this dialog lists the ones in the script, with
 * jump-to and remove.
 */
import type { DeliveryMark } from '~/services/types'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ body: string; marks: DeliveryMark[] }>()
const emit = defineEmits<{
  remove: [id: string]
  jump: [m: DeliveryMark]
}>()
const { t } = useI18n()

const listed = computed(() =>
  [...props.marks].sort((a, b) => a.start - b.start).map(m => ({
    m,
    label: t(`editor.marks.${m.type}`),
    text:
      m.type === 'pause'
        ? t('editor.marks.pauseChip', { s: m.pauseSec ?? 1 })
        : `«${props.body.slice(m.start, m.end).slice(0, 40)}»${m.type === 'note' && m.note ? ` — ${m.note}` : ''}`,
  })),
)
</script>

<template>
  <UiDialog v-model:open="open" :title="t('editor.marks.title')">
    <h3>{{ t('editor.marks.inScript', { n: marks.length }) }}</h3>
    <p v-if="!marks.length" class="empty">{{ t('editor.marks.none') }}</p>
    <ul v-else class="list">
      <li v-for="row in listed" :key="row.m.id">
        <button type="button" class="jump" @click="emit('jump', row.m)">
          <span class="sw" :class="row.m.type === 'emphasis' ? 'emph' : row.m.type === 'pause' ? 'pz' : 'note'" aria-hidden="true">{{ row.m.type === 'pause' ? '/' : '' }}</span>
          <span class="k">{{ row.label }}</span>
          <span class="v" dir="auto">{{ row.text }}</span>
        </button>
        <button type="button" class="rm" :aria-label="t('editor.marks.remove', { mark: row.label })" @click="emit('remove', row.m.id)">
          <UiGlyph name="close" :size="16" />
        </button>
      </li>
    </ul>

    <template #actions>
      <UiButton @click="open = false">{{ t('library.done') }}</UiButton>
    </template>
  </UiDialog>
</template>

<style scoped>
.sw {
  display: inline-grid;
  place-items: center;
  inline-size: 18px;
  block-size: 18px;
  border-radius: 4px;
  font: 600 12px/1 var(--tilw-font-lat);
}
.sw.emph { background: var(--tilw-stage-cue); }
.sw.pz { border: 1px dashed var(--tilw-action-primary); color: var(--tilw-action-primary); }
.sw.note { border-block-end: 2px dotted var(--tilw-action-primary); border-radius: 0; }
h3 {
  margin-block-start: 12px;
  font: 500 18px/1.36 var(--tilw-font-ar);
  color: var(--tilw-text-ink);
}
.empty {
  font-size: 15px;
}
.list {
  display: grid;
  gap: 6px;
  max-block-size: 240px;
  overflow: auto;
  margin: 0;
  padding: 0;
  list-style: none;
}
.list li {
  display: flex;
  align-items: center;
  gap: 6px;
  border-radius: 8px;
  background: var(--tilw-surface-white);
}
.jump {
  flex: 1;
  min-inline-size: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 0;
  background: none;
  color: var(--tilw-text-ink);
  font: 400 15px/1.4 var(--tilw-font-ar);
  text-align: start;
}
.k {
  flex: 0 0 auto;
  color: var(--tilw-action-primary);
  font-weight: 500;
}
.v {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rm {
  display: grid;
  place-items: center;
  inline-size: 40px;
  block-size: 40px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--tilw-text-muted);
}
.rm:hover {
  color: var(--tilw-status-error);
}
</style>
