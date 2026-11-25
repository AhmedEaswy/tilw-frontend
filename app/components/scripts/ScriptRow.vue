<script setup lang="ts">
/**
 * One row of "كل النصوص" (6:18 / 6:20): cover tile, title, edited + duration, and the "…" button that opens the
 * script's options as a dropdown menu (rename, duplicate, download, pin, archive / restore).
 * The selected row (last opened) gets the bordered surface.
 */
import type { ScriptSummary } from '~/services/types'
import type { GlyphName } from '~/components/ui/UiGlyph.vue'
import type { UiMenuItem } from '~/components/ui/UiMenu.vue'

export type ScriptAction = 'rename' | 'duplicate' | 'download' | 'pin' | 'archive'

/** `takes`: how many recordings of this script are on this device or in Drive (shown when there are any). */
const props = defineProps<{ script: ScriptSummary; current?: boolean; takes?: number }>()
const emit = defineEmits<{ action: [action: ScriptAction] }>()
const { t, locale } = useI18n()
const label = useEditedLabel()
const takesLabel = computed(() => (props.takes ? `${props.takes} ${unitFor(props.takes, 'recording', locale.value)}` : ''))

// An archived script can only be restored (same as the old actions sheet, 6:108).
const items = computed<UiMenuItem[]>(() => {
  const s = props.script
  const archive: UiMenuItem = { key: 'archive', label: s.archivedAt ? t('library.restore') : t('library.archive'), icon: 'archive' }
  if (s.archivedAt) return [archive]
  return [
    { key: 'rename', label: t('library.rename'), icon: 'edit' },
    { key: 'duplicate', label: t('library.duplicate'), icon: 'copy' },
    { key: 'download', label: t('library.downloadTxt'), icon: 'download' },
    { key: 'pin', label: s.pinned ? t('library.unpin') : t('library.pin'), icon: 'pin' },
    archive,
  ]
})

// Figma shows three cover styles (file / video / mail). Scripts have no "subject" yet, so the cover
// is picked from the id to stay stable for each script.
const COVERS: { icon: GlyphName; bg: string }[] = [
  { icon: 'file', bg: 'var(--tilw-surface-sage)' },
  { icon: 'video', bg: 'var(--tilw-surface-sand)' },
  { icon: 'mail', bg: 'var(--tilw-surface-selected)' },
]
const cover = computed(() => {
  let h = 0
  for (const ch of props.script.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return COVERS[h % COVERS.length]!
})
</script>

<template>
  <li class="row" :class="{ current }">
    <NuxtLink :to="`/app/scripts/${script.id}`" class="row-link">
      <span class="cover" :style="{ background: cover.bg }" aria-hidden="true"><UiGlyph :name="cover.icon" :size="24" /></span>
      <span class="txt">
        <span class="title" dir="auto">{{ script.title }}</span>
        <span class="meta">
          <UiGlyph v-if="script.pinned" name="pin" :size="14" :label="t('library.pinned')" />
          {{ label(script) }}
          <span v-if="takesLabel" class="takes" data-testid="script-takes"><UiGlyph name="video" :size="14" />{{ takesLabel }}</span>
        </span>
      </span>
    </NuxtLink>
    <UiMenu
      class="menu"
      trigger-class="more"
      :items="items"
      :label="t('library.actionsFor', { title: script.title })"
      @select="k => emit('action', k as ScriptAction)"
    />
  </li>
</template>

<style scoped>
.row {
  position: relative;
  display: flex;
  align-items: center;
  min-block-size: 76px;
  border-radius: var(--tilw-radius-row);
}
.row:not(.current)::after {
  content: '';
  position: absolute;
  inset-inline: 14px;
  inset-block-end: -2px;
  block-size: 1px;
  background: var(--tilw-border-subtle);
}
.row.current {
  border: 1px solid var(--tilw-border-subtle);
  background: var(--tilw-surface-white);
}
.row-link {
  flex: 1;
  min-inline-size: 0;
  display: flex;
  align-items: center;
  gap: 17px;
  padding-block: 15px;
  padding-inline: 19px 8px;
  color: inherit;
  text-decoration: none;
  border-radius: inherit;
}
/* Only this row's own link: a bare `.main` here also matched the layout's <main> (all titles lit). */
.row-link:hover .title,
.row-link:focus-visible .title {
  color: var(--tilw-action-primary);
}
.cover {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  inline-size: 43px;
  block-size: 43px;
  border-radius: 6px;
  color: var(--tilw-text-ink);
}
.txt {
  min-inline-size: 0;
  display: grid;
  gap: 3px;
}
.title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: 500 21px/31px var(--tilw-font-ar);
}
.meta {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: pre;
  font: 400 14px/20px var(--tilw-font-ar);
  color: var(--tilw-text-muted);
}
.takes {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-inline-start: 4px;
}
.takes::before {
  content: '·';
  margin-inline-end: 4px;
  color: var(--tilw-text-muted);
}
.meta :deep(.ui-glyph) {
  color: var(--tilw-action-primary);
}
.menu {
  flex: 0 0 auto;
}
.menu :deep(.more) {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  inline-size: var(--tilw-hit);
  block-size: var(--tilw-hit);
  margin-inline-end: 8px;
  border: 0;
  border-radius: 10px;
  background: none;
  color: var(--tilw-text-ink);
}
.menu :deep(.more:hover),
.menu :deep(.more[aria-expanded='true']) {
  background: var(--tilw-surface-quiet);
}
.menu :deep(.more:focus-visible) {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
@media (max-width: 760px) {
  .title { font-size: 19px; line-height: 28px; }
}
</style>
