<script setup lang="ts">
/**
 * Modal dialog matching the 700×520 library dialogs (6:23 new, 6:24 import, 6:25 sort): large title,
 * rule under it, body, and a footer with the main action at the start and "رجوع" at the end.
 * On phones it becomes the bottom sheet from "Script actions · phone" (6:108): handle, title, rule.
 * Uses the native <dialog> for focus trapping, Esc and focus restore.
 */
const open = defineModel<boolean>('open', { default: false })
const props = withDefaults(defineProps<{ title: string; dismissible?: boolean }>(), { dismissible: true })
const emit = defineEmits<{ close: [] }>()
const el = ref<HTMLDialogElement>()
const titleId = useId()

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
defineExpose({ close })
</script>

<template>
  <dialog ref="el" class="ui-dialog" :aria-labelledby="titleId" @cancel="onCancel" @click="onBackdrop">
    <div class="panel">
      <span class="handle" aria-hidden="true" />
      <h2 :id="titleId">{{ title }}</h2>
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
  inline-size: 700px;
  max-inline-size: calc(100vw - 32px);
}
.ui-dialog::backdrop {
  background: var(--tilw-scrim);
}
.panel {
  display: grid;
  gap: 0;
  padding: 41px 40px 40px;
  border-radius: var(--tilw-radius-card);
  background: var(--tilw-surface-paper);
  box-shadow: var(--tilw-shadow-pop);
}
.handle {
  display: none;
}
h2 {
  padding-block-end: 21px;
  border-block-end: 1px solid var(--tilw-border-subtle);
  font: 700 39px/1.36 var(--tilw-font-ar);
}
:lang(en) h2 {
  font-family: var(--tilw-font-lat);
}
.body {
  display: grid;
  gap: var(--tilw-space-16);
  padding-block: 38px 64px;
  font: 400 22px/1.36 var(--tilw-font-ar);
  color: var(--tilw-text-muted);
}
footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--tilw-space-12);
}
footer :deep(.ui-btn.t-primary) {
  min-inline-size: 236px;
}
footer :deep(.ui-btn.t-secondary) {
  min-inline-size: 125px;
}

/* Phone: bottom sheet (6:108). */
@media (max-width: 600px) {
  .ui-dialog {
    inline-size: 100vw;
    max-inline-size: 100vw;
    max-block-size: 92dvh;
    margin: auto 0 0;
  }
  .panel {
    padding: 12px max(19px, env(safe-area-inset-left, 0px)) calc(24px + env(safe-area-inset-bottom, 0px)) max(19px, env(safe-area-inset-right, 0px));
    border-end-start-radius: 0;
    border-end-end-radius: 0;
    border-start-start-radius: 19px;
    border-start-end-radius: 19px;
  }
  .handle {
    display: block;
    justify-self: center;
    inline-size: 52px;
    block-size: 4px;
    margin-block-end: 25px;
    border-radius: 2px;
    background: var(--tilw-border-strong);
  }
  h2 {
    padding-block-end: 19px;
    font-size: 27px;
  }
  .body {
    padding-block: 20px 40px;
    font-size: 18px;
  }
  footer {
    flex-direction: column;
  }
  footer :deep(.ui-btn) {
    inline-size: 100%;
  }
}
</style>
