<script setup lang="ts">
/**
 * Feature 004 (Figma L4 `278:164`, L5 `278:273`): the phone remote's frame — brand and language only, no studio
 * chrome, on the dark stage. The phone has no account here.
 */
const { locale, setLocale } = useI18n()
const other = computed(() => (locale.value === 'ar' ? 'en' : 'ar'))
async function switchLocale() {
  const next = other.value
  try { localStorage.setItem('tilw:remote:locale', next) } catch { /* private mode */ }
  await setLocale(next)
}
</script>

<template>
  <div class="remote">
    <header class="bar">
      <BrandSignature surface="stage" :width="150" />
      <button type="button" class="lang" @click="switchLocale">
        <UiGlyph name="language" :size="18" />
        <span :lang="other">{{ other === 'en' ? 'English' : 'العربية' }}</span>
      </button>
    </header>
    <main class="body">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.remote {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-block-size: 100dvh;
  background: var(--tilw-stage-background);
  color: var(--tilw-stage-text);
}
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: max(16px, env(safe-area-inset-top, 0px)) max(20px, env(safe-area-inset-right, 0px)) 8px max(20px, env(safe-area-inset-left, 0px));
}
.lang {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-block-size: 44px;
  padding: 0 4px;
  border: 0;
  background: none;
  color: var(--tilw-stage-secondary);
  font: 500 15px/1.36 var(--tilw-font-ar);
}
.lang:focus-visible {
  outline: 2px solid var(--tilw-stage-cue);
  outline-offset: 2px;
}
.body {
  display: flex;
  flex-direction: column;
  inline-size: min(100%, 480px);
  margin-inline: auto;
  padding: 12px max(20px, env(safe-area-inset-right, 0px)) calc(24px + env(safe-area-inset-bottom, 0px)) max(20px, env(safe-area-inset-left, 0px));
}
</style>
