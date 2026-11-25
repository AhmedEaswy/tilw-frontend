<script setup lang="ts">
/**
 * A script's Recordings tab: the same "Back to my scripts" row as the editor, with the Script / Recordings tabs at its
 * end, then this script's takes (RecordingsView filtered to the script).
 */
definePageMeta({ layout: 'app' })
const { t } = useI18n()
const route = useRoute()
const id = computed(() => String(route.params.id))
const scripts = useScriptsStore()
// The heading waits for the script's title (a skeleton line), unless it is already cached.
const titlePending = ref(!scripts.items.some(s => s.id === id.value))
onMounted(async () => {
  if (scripts.items.some(s => s.id === id.value)) return
  try {
    scripts.upsert(await useServices().scripts.get(id.value))
  } catch { /* the heading falls back to "Recordings" */ } finally {
    titlePending.value = false
  }
})
const title = computed(() => scripts.items.find(s => s.id === id.value)?.title)
useHead({ title: () => `${title.value ?? t('nav.recordings')} · ${t('scriptTabs.recordings')} · tilwprompter` })
</script>

<template>
  <div class="script-recs">
    <div class="bar">
      <NuxtLink to="/app/scripts" class="back">
        <UiGlyph class="back-ic" name="back" :size="22" />
        <span class="lbl">{{ t('library.backToScripts') }}</span>
      </NuxtLink>
      <ScriptTabs :script-id="id" current="recordings" />
    </div>
    <RecordingsView :script-id="id" :title="title" :title-pending="titlePending" />
  </div>
</template>

<style scoped>
/* The same row as the editor's (scripts/[id]/index.vue). */
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-block-start: 37px;
}
.back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tilw-action-primary);
  font: 500 16px/1.36 var(--tilw-font-ar);
  text-decoration: none;
}
.back:hover .lbl {
  text-decoration: underline;
}
.back-ic {
  display: none;
}
.script-recs :deep(.rec-list) {
  padding-block-start: 20px;
}
@media (max-width: 760px) {
  .back .lbl {
    display: none;
  }
  .back-ic {
    display: inline-block;
    color: var(--tilw-text-ink);
  }
  .back {
    inline-size: var(--tilw-hit);
    block-size: var(--tilw-hit);
    justify-content: center;
  }
}
</style>
