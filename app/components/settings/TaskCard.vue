<script setup lang="ts">
/**
 * "Task dialog" from the settings flows (6:66 export, 6:67 handoff, 6:68–6:71 legacy recovery; also used for
 * account edit G5 and delete G4): a 628-px card on the paper surface with a kicker, title, lede, content,
 * and actions — main action at the start, the way back at the end.
 */
defineProps<{ kicker: string; title: string; lede?: string }>()
const titleId = useId()
</script>

<template>
  <section class="task" :aria-labelledby="titleId">
    <p class="kicker">{{ kicker }}</p>
    <h1 :id="titleId">{{ title }}</h1>
    <p v-if="lede" class="lede">{{ lede }}</p>
    <div v-if="$slots.default" class="body"><slot /></div>
    <footer v-if="$slots.actions" class="acts"><slot name="actions" /></footer>
  </section>
</template>

<style scoped>
.task {
  inline-size: min(628px, 100%);
  margin: 70px auto 40px;
  padding: 32px 40px 48px;
  border-radius: 16px;
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
}
.kicker {
  margin: 0;
  color: var(--tilw-action-primary);
  font: 500 16px/1.36 var(--tilw-font-ar);
}
h1 {
  margin: 32px 0 0;
  font: 700 34px/1.36 var(--tilw-font-ar);
}
.lede {
  margin: 22px 0 0;
  color: var(--tilw-text-muted);
  font: 400 19px/1.52 var(--tilw-font-ar);
}
.body {
  display: grid;
  gap: 16px;
  margin-block-start: 34px;
}
.acts {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  margin-block-start: 30px;
}
.acts :deep(.ui-btn.t-primary),
.acts :deep(.ui-btn.t-danger) {
  min-inline-size: 282px;
}
.acts :deep(.ui-btn.t-secondary) {
  min-inline-size: 175px;
}

@media (max-width: 760px) {
  .task {
    margin-block: 24px;
    padding: 24px 20px 32px;
  }
  h1 {
    margin-block-start: 16px;
    font-size: 28px;
  }
  .lede {
    font-size: 17px;
  }
  .acts {
    flex-direction: column;
  }
  .acts :deep(.ui-btn) {
    inline-size: 100%;
    min-inline-size: 0 !important;
  }
}
</style>
