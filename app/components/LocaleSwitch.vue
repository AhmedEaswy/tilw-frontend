<script setup lang="ts">
/** Switch between العربية and English. The choice persists in the tilw-locale cookie. */
const { locale, locales, setLocale } = useI18n()
const saved = useCookie<'ar' | 'en' | null>('tilw-locale', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
const other = computed(() => locales.value.find(l => l.code !== locale.value)!)

async function toggle() {
  const code = other.value.code as 'ar' | 'en'
  saved.value = code
  await setLocale(code)
}
</script>

<template>
  <button type="button" class="locale" :lang="other.code" @click="toggle">
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
