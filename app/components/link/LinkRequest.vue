<script setup lang="ts">
/**
 * Feature 004, US4 (T042, Figma L3 `288:604` second phone, `288:683` the app asks to read): a non-modal popover under
 * the link indicator for a request that needs the owner's answer. The page hides it during a countdown or a take
 * (research R13): the indicator keeps its badge and the request waits in the panel.
 */
const props = defineProps<{
  /** A second phone asking to take over, or the Tilw app asking to swap roles. */
  kind: 'remote' | 'roles'
  /** The second phone's name (kind `remote`). */
  name?: string
  /** The role swap asked for: `remote` = the app reads, `host` = the studio reads again. */
  player?: 'host' | 'remote'
  /** When the request lapses, if known. */
  expiresAt?: string | null
}>()
const emit = defineEmits<{ accept: []; decline: [] }>()
const { t } = useI18n()
const now = shallowRef(Date.now())
useIntervalFn(() => (now.value = Date.now()), 1000)

const left = computed(() => {
  if (!props.expiresAt) return ''
  const sec = Math.max(0, Math.ceil((new Date(props.expiresAt).getTime() - now.value) / 1000))
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
})
const text = computed(() => props.kind === 'remote'
  ? t('link.requestText', { name: props.name ?? '' })
  : props.player === 'remote' ? t('link.rolesAskRead') : t('link.rolesAskBack'))
const titleId = useId()
</script>

<template>
  <div class="pop" role="alertdialog" :aria-labelledby="titleId" data-link-request>
    <p :id="titleId" class="title" dir="auto">{{ text }}</p>
    <p v-if="left" class="meta">{{ t('link.answerWithin', { time: left }) }}</p>
    <div class="acts">
      <UiButton tone="secondary" size="sm" @click="emit('decline')">{{ t('link.decline') }}</UiButton>
      <UiButton tone="cue" size="sm" @click="emit('accept')">{{ kind === 'roles' ? t('link.swapAccept') : t('link.accept') }}</UiButton>
    </div>
  </div>
</template>

<style scoped>
.pop {
  position: absolute;
  inset-block-start: calc(100% + 10px);
  inset-inline-end: 0;
  z-index: 30;
  display: grid;
  gap: 12px;
  inline-size: min(340px, calc(100vw - 32px));
  padding: 18px 20px;
  border-radius: 16px;
  background: var(--tilw-surface-white);
  box-shadow: var(--tilw-shadow-pop);
  color: var(--tilw-text-ink);
}
.title {
  margin: 0;
  font: 700 16px/1.5 var(--tilw-font-ar);
}
.meta {
  margin: 0;
  color: var(--tilw-text-muted);
  font: 400 14px/1.5 var(--tilw-font-ar);
}
.acts {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
