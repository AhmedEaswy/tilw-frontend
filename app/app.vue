<script setup lang="ts">
const prefs = usePrefsStore()
onMounted(() => prefs.load())

// <html lang dir> follows the UI locale (ar → rtl, en → ltr). Pages may override (the landing is Arabic-only).
const localeHead = useLocaleHead({ seo: false })
useHead(() => ({ htmlAttrs: { lang: localeHead.value.htmlAttrs?.lang, dir: localeHead.value.htmlAttrs?.dir } }))
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <UiToast />
  <ClientOnly><OfflineBanner /></ClientOnly>
  <!-- Floating mini player: stays on screen across pages, like YouTube's. -->
  <ClientOnly><MiniPlayer /></ClientOnly>
</template>
