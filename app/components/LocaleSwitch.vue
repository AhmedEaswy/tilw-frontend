<script setup lang="ts">
/** Switch between العربية and English (auth pages). Same choice as the account menu: cookie, then the account when signed in. */
const { other, choose } = useLocaleChoice()
</script>

<template>
  <button type="button" class="locale" :lang="other.code" @click="choose(other.code)">
    <UiGlyph name="language" :size="18" />
    {{ other.name }}
  </button>
</template>

<style scoped>
.locale {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-block-size: 36px;
  padding-inline: 10px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--tilw-text-muted);
  font: 500 13px/1 var(--tilw-font-ar);
}
.locale:lang(en) {
  font-family: var(--tilw-font-lat);
}
.locale:hover {
  color: var(--tilw-text-ink);
  background: var(--tilw-surface-quiet);
}
</style>
