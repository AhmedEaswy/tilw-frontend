<script setup lang="ts">
/**
 * 404 and unexpected errors (US9, T104 — G10, no frame: built from the paper surface, signature and the
 * task-card type scale). Offers the way home, and the scripts library when the user is signed in.
 */
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const { t } = useI18n()
const auth = useAuthStore()

const notFound = computed(() => props.error?.statusCode === 404)
useHead({ title: () => `${notFound.value ? t('errorPage.notFoundTitle') : t('errorPage.title')} · tilwprompter`, meta: [{ name: 'robots', content: 'noindex' }] })

function home() {
  clearError({ redirect: '/' })
}
function library() {
  clearError({ redirect: '/app/scripts' })
}
function retry() {
  clearError()
  if (import.meta.client) window.location.reload()
}
</script>

<template>
  <div class="err">
    <header class="top">
      <a href="/" class="brand" :aria-label="t('nav.home')" @click.prevent="home"><BrandSignature :width="143" /></a>
    </header>
    <main class="body">
      <p class="code" dir="ltr">{{ error?.statusCode ?? 500 }}</p>
      <h1>{{ notFound ? t('errorPage.notFoundTitle') : t('errorPage.title') }}</h1>
      <p class="lede">{{ notFound ? t('errorPage.notFoundLede') : t('errorPage.lede') }}</p>
      <div class="acts">
        <UiButton v-if="auth.status === 'authed'" @click="library">{{ t('library.backToScripts') }}</UiButton>
        <UiButton v-if="!notFound" :tone="auth.status === 'authed' ? 'secondary' : 'primary'" @click="retry">{{ t('common.retry') }}</UiButton>
        <UiButton tone="secondary" @click="home">{{ t('nav.backToSite') }}</UiButton>
      </div>
    </main>
  </div>
</template>

<style scoped>
.err {
  min-block-size: 100dvh;
  background: var(--tilw-surface-paper);
  color: var(--tilw-text-ink);
}
.top {
  display: flex;
  align-items: center;
  block-size: 76px;
  padding-inline: max(24px, env(safe-area-inset-left, 0px)) max(24px, env(safe-area-inset-right, 0px));
  border-block-end: 1px solid var(--tilw-border-subtle);
}
.brand {
  display: flex;
}
.body {
  display: grid;
  justify-items: start;
  inline-size: min(628px, calc(100% - 48px));
  margin: 90px auto 48px;
}
.code {
  margin: 0;
  color: var(--tilw-action-primary);
  font: 500 16px/1.36 var(--tilw-font-lat);
}
h1 {
  margin: 20px 0 0;
  font: 700 34px/1.36 var(--tilw-font-ar);
}
.lede {
  margin: 18px 0 0;
  color: var(--tilw-text-muted);
  font: 400 19px/1.52 var(--tilw-font-ar);
}
.acts {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-block-start: 34px;
}
.brand:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
@media (max-width: 760px) {
  .body {
    margin-block-start: 48px;
  }
  h1 {
    font-size: 28px;
  }
  .acts {
    flex-direction: column;
    align-self: stretch;
    inline-size: 100%;
  }
}
</style>
