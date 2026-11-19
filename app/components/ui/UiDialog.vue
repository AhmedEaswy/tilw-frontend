<script setup lang="ts">
/**
 * Modal dialog (Figma 6:23 / 6:24 / 6:25 are 700×520 dialogs). On phones it becomes a bottom sheet
 * (6:108–6:110). Uses the native <dialog> for focus trapping, Esc and focus restore.
 */
const open = defineModel<boolean>('open', { default: false })
const props = withDefaults(defineProps<{ title: string; size?: 'sm' | 'md'; dismissible?: boolean }>(), {
  size: 'md',
  dismissible: true,
})
const emit = defineEmits<{ close: [] }>()
const el = ref<HTMLDialogElement>()
const titleId = useId()
const { t } = useI18n()

watch(
  open,
  (v) => {
    if (!el.value) return
    if (v && !el.value.open) el.value.showModal()
    if (!v && el.value.open) el.value.close()
  },
  { flush: 'post' },
)
onMounted(() => {
  if (open.value) el.value?.showModal()
})

function close() {
  if (!props.dismissible) return
  open.value = false
  emit('close')
}
function onCancel(e: Event) {
  e.preventDefault()
  close()
}
function onBackdrop(e: MouseEvent) {
  if (e.target === el.value) close()
}
</script>

<template>
  <dialog ref="el" class="ui-dialog" :class="`s-${size}`" :aria-labelledby="titleId" @cancel="onCancel" @click="onBackdrop">
    <div class="panel">
      <header>
        <h2 :id="titleId">{{ title }}</h2>
        <button v-if="dismissible" type="button" class="x" :aria-label="t('common.close')" @click="close">
          <UiGlyph name="close" :size="22" />
        </button>
      </header>
      <div class="body"><slot /></div>
      <footer v-if="$slots.actions"><slot name="actions" /></footer>
    </div>
  </dialog>
</template>

<style scoped>
.ui-dialog {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--tilw-text-ink);
  max-inline-size: calc(100vw - 32px);
  inline-size: 560px;
}
.ui-dialog.s-sm {
  inline-size: 460px;
}
.ui-dialog::backdrop {
  background: var(--tilw-scrim);
}
.panel {
  display: grid;
  gap: var(--tilw-space-24);
  padding: var(--tilw-space-32);
  border-radius: var(--tilw-radius-card);
  background: var(--tilw-surface-paper);
  box-shadow: var(--tilw-shadow-pop);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tilw-space-16);
}
h2 {
  font: var(--tilw-type-heading);
}
.x {
  display: grid;
  place-items: center;
  inline-size: var(--tilw-hit);
  block-size: var(--tilw-hit);
  margin-inline-end: -10px;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--tilw-text-muted);
}
.x:hover {
  background: var(--tilw-surface-quiet);
}
.body {
  display: grid;
  gap: var(--tilw-space-16);
}
footer {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tilw-space-12);
  justify-content: flex-start;
}

@media (max-width: 600px) {
  .ui-dialog,
  .ui-dialog.s-sm {
    inline-size: 100vw;
    max-inline-size: 100vw;
    margin: auto 0 0;
  }
  .panel {
    padding: var(--tilw-space-24) max(16px, env(safe-area-inset-left, 0px)) calc(var(--tilw-space-24) + env(safe-area-inset-bottom, 0px));
    border-end-start-radius: 0;
    border-end-end-radius: 0;
  }
  footer :deep(.ui-btn) {
    flex: 1;
  }
}
</style>
