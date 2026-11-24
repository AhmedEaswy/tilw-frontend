<script setup lang="ts">
/** Feature 006 (component `Admin / Stat tile` 306:156): a label, a big value and a note. */
defineProps<{ label: string; value: string | number; note?: string }>()
</script>

<template>
  <div class="stat">
    <span class="l">{{ label }}</span>
    <strong class="v adm-ltr">{{ value }}</strong>
    <span v-if="note" class="n">{{ note }}</span>
  </div>
</template>

<style scoped>
.stat {
  display: grid;
  gap: 4px;
  padding: 14px 16px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: 14px;
  background: var(--tilw-surface-white);
}
.l,
.n {
  color: var(--tilw-text-muted);
  font: 500 13px/1.4 var(--tilw-font-ar);
}
.n {
  font-size: 12px;
}
.v {
  justify-self: start;
  font: 700 26px/1.2 var(--tilw-font-ar);
  font-variant-numeric: tabular-nums;
}
</style>
