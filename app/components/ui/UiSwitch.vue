<script setup lang="ts">
/** Figma "Switch" (5:126): one binary setting; position and track fill show state. */
const model = defineModel<boolean>({ default: false })
defineProps<{ label: string }>()
</script>

<template>
  <button type="button" role="switch" class="ui-switch" :aria-checked="model" :aria-label="label" @click="model = !model">
    <span class="thumb" />
  </button>
</template>

<style scoped>
.ui-switch {
  position: relative;
  flex: 0 0 auto;
  inline-size: 50px;
  block-size: 28px;
  padding: 0;
  border: 0;
  border-radius: 14px;
  background: var(--tilw-border-strong);
  transition: background-color 0.2s;
}
.ui-switch[aria-checked='true'] {
  background: var(--tilw-action-primary);
}
.thumb {
  position: absolute;
  inset-block-start: 3px;
  inset-inline-start: 3px;
  inline-size: 22px;
  block-size: 22px;
  border-radius: 11px;
  background: var(--tilw-text-on-solid);
  transition: inset-inline-start 0.2s;
}
.ui-switch[aria-checked='true'] .thumb {
  inset-inline-start: 25px;
}
</style>
