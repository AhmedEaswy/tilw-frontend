<script setup lang="ts">
/**
 * Feature 005 (A2 preview `293:377`): a script's paragraphs with its delivery marks, read-only, in the reader's look:
 * emphasis in bold accent, a pause as a small chip where it falls, a note as a chip after its words with the words
 * underlined. The text direction follows the script.
 */
import type { DeliveryMark } from '~/services/types'
import { paragraphRanges } from '~/utils/marks'

const props = defineProps<{ body: string; marks: DeliveryMark[]; direction?: 'auto' | 'rtl' | 'ltr' }>()
const { t } = useI18n()

interface Seg { text: string; emph: boolean; note: boolean; pause?: number; noteLabel?: string }

const paragraphs = computed(() => paragraphRanges(props.body).map((r) => {
  const marks = props.marks.filter(m => m.start <= r.end && m.end >= r.start)
  const cuts = new Set<number>([r.start, r.end])
  for (const m of marks) {
    if (m.start > r.start && m.start < r.end) cuts.add(m.start)
    if (m.end > r.start && m.end < r.end) cuts.add(m.end)
  }
  const points = [...cuts].sort((a, b) => a - b)
  const segs: Seg[] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!
    for (const p of marks.filter(m => m.type === 'pause' && m.start === a && a > r.start)) segs.push({ text: '', emph: false, note: false, pause: p.pauseSec ?? 1 })
    const b = points[i + 1]
    if (b === undefined) break
    const inside = (type: DeliveryMark['type']) => marks.find(m => m.type === type && m.start <= a && m.end >= b)
    segs.push({ text: props.body.slice(a, b), emph: !!inside('emphasis'), note: !!inside('note') })
    for (const n of marks.filter(m => m.type === 'note' && m.end === b)) segs.push({ text: '', emph: false, note: false, noteLabel: n.note ?? '' })
  }
  return segs
}))
</script>

<template>
  <article class="marked" :dir="direction ?? 'auto'">
    <p v-for="(segs, i) in paragraphs" :key="i" dir="auto">
      <template v-for="(s, j) in segs" :key="j">
        <span v-if="s.pause !== undefined" class="chip pause">{{ t('ai.format.pause', { s: s.pause }) }}</span>
        <span v-else-if="s.noteLabel !== undefined" class="chip note">{{ t('ai.format.noteMark', { note: s.noteLabel }) }}</span>
        <strong v-else-if="s.emph" :class="{ noted: s.note }">{{ s.text }}</strong>
        <span v-else :class="{ noted: s.note }">{{ s.text }}</span>
      </template>
    </p>
  </article>
</template>

<style scoped>
.marked {
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: 10px;
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
}
p {
  margin: 0;
  font: 400 18px/1.9 var(--tilw-font-ar);
  white-space: pre-wrap;
}
strong {
  color: var(--tilw-action-primary);
  font-weight: 700;
}
.noted {
  text-decoration: underline dotted var(--tilw-action-primary);
  text-underline-offset: 5px;
}
.chip {
  display: inline-block;
  margin-inline: 4px;
  padding: 0 10px;
  border-radius: 10px;
  font: 500 12px/1.9 var(--tilw-font-ar);
  vertical-align: middle;
  white-space: nowrap;
}
.pause {
  background: var(--tilw-surface-sand, var(--tilw-surface-quiet));
}
.note {
  background: var(--tilw-surface-selected);
  color: var(--tilw-action-primary);
}
</style>
