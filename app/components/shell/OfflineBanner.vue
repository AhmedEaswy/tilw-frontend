<script setup lang="ts">
/**
 * Offline notice (US9, T104 — G10). A thin bar at the bottom of the screen while the browser is offline, and a
 * short "back online" message when it returns. The editor keeps its own local draft and save status; this bar
 * says why saving is paused everywhere else. Hidden on the reading and recording stages, which work offline.
 */
const { t } = useI18n()
const route = useRoute()
const online = useOnline()
const back = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

watch(online, (now, before) => {
  if (now && before === false) {
    back.value = true
    clearTimeout(timer)
    timer = setTimeout(() => (back.value = false), 4000)
  }
})
onBeforeUnmount(() => clearTimeout(timer))

const stage = computed(() => /\/app\/scripts\/[^/]+\/(rehearse|record)$/.test(route.path))
const show = computed(() => import.meta.client && !stage.value && (!online.value || back.value))
</script>

<template>
  <div v-if="show" class="offline" :class="{ ok: online }" role="status">
    <UiGlyph :name="online ? 'check' : 'clock'" :size="18" />
    <span>{{ online ? t('offline.back') : t('offline.text') }}</span>
  </div>
</template>

<style scoped>
.offline {
  position: fixed;
  inset-inline: 0;
  inset-block-end: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px max(16px, env(safe-area-inset-left, 0px)) calc(10px + env(safe-area-inset-bottom, 0px));
  background: var(--tilw-text-ink);
  color: var(--tilw-surface-paper);
  font: 500 14px/1.4 var(--tilw-font-ar);
  text-align: center;
}
.offline.ok {
  background: var(--tilw-status-success);
  color: var(--tilw-surface-paper);
}
</style>
