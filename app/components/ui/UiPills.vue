<script setup lang="ts" generic="T extends string">
/** Filter pills (library: الكل / المثبتة / المؤرشفة, Figma 6:18 "Filter"). Selected pill is solid ink. */
const model = defineModel<T>({ required: true })
defineProps<{ options: { value: T; label: string }[]; label: string }>()
</script>

<template>
  <div class="ui-pills" role="tablist" :aria-label="label">
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      role="tab"
      :aria-selected="o.value === model"
      @click="model = o.value"
    >
      {{ o.label }}
    </button>
  </div>
</template>

<style scoped>
.ui-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
button {
  min-inline-size: 93px;
  block-size: 34px;
  padding-inline: var(--tilw-space-16);
  border: 0;
  border-radius: 17px;
  background: transparent;
  color: var(--tilw-text-muted);
  font: 500 15px/1.36 var(--tilw-font-ar);
}
button:hover {
  background: var(--tilw-surface-quiet);
}
button[aria-selected='true'] {
  background: var(--tilw-text-ink);
  color: var(--tilw-surface-white);
}
</style>
