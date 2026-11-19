<script setup lang="ts">
/**
 * Auth frame from "Sign in · existing member" (6:62, phone 6:100): studio photograph on one side,
 * signature + form column on the other, legal links at the bottom. Also hosts waitlist (6:63/6:64),
 * recovery (6:101/6:102), reset and invite screens (G1/G2 are built from this frame by owner decision).
 *
 * Page meta:
 *   authPhoto: 'portrait' (default, sign in) | 'glass' (waitlist)
 *   authBack:  route for the back button shown opposite the signature (recovery frames 6:101/6:102)
 */
const { t } = useI18n()
const route = useRoute()
const photo = computed(() => (route.meta.authPhoto === 'glass' ? '/media/glass.png' : '/assets/portrait.png'))
const back = computed(() => route.meta.authBack as string | undefined)
</script>

<template>
  <div class="auth">
    <div class="photo" aria-hidden="true">
      <img :src="photo" alt="" :class="{ glass: route.meta.authPhoto === 'glass' }">
    </div>
    <main class="col">
      <div class="top">
        <NuxtLink to="/" class="brand" :aria-label="t('nav.home')"><BrandSignature :width="150" /></NuxtLink>
        <NuxtLink v-if="back" :to="back" class="back" :aria-label="t('common.back')">
          <UiGlyph name="arrow-back" :size="20" />
        </NuxtLink>
      </div>
      <div class="content"><slot /></div>
      <nav class="legal" :aria-label="t('nav.legal')">
        <NuxtLink to="/privacy">{{ t('legal.privacy') }}</NuxtLink>
        <NuxtLink to="/terms">{{ t('legal.terms') }}</NuxtLink>
        <LocaleSwitch />
      </nav>
    </main>
  </div>
</template>

<style scoped>
.auth {
  display: grid;
  grid-template-columns: minmax(0, 476fr) minmax(0, 620fr);
  gap: var(--tilw-space-24);
  min-block-size: 100dvh;
  padding: var(--tilw-space-24);
  padding-inline: max(var(--tilw-space-24), env(safe-area-inset-left, 0px)) max(var(--tilw-space-24), env(safe-area-inset-right, 0px));
  background: var(--tilw-surface-paper);
}
/* In Arabic the photograph sits on the left (inline-end); in English it mirrors. */
.photo {
  order: 2;
  position: sticky;
  inset-block-start: var(--tilw-space-24);
  block-size: calc(100dvh - 48px);
  border-radius: 22px;
  overflow: hidden;
  background: var(--tilw-stage-surface);
}
.photo img {
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
  object-position: 42% 30%;
}
.photo img.glass {
  object-position: 30% 50%;
}
.col {
  order: 1;
  min-inline-size: 0;
  display: grid;
  grid-template-rows: auto 1fr auto;
  justify-items: center;
  padding-block: 27px 4px;
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tilw-space-16);
  inline-size: min(456px, 100%);
  min-block-size: 44px;
}
.brand {
  display: flex;
}
.back {
  display: grid;
  place-items: center;
  inline-size: var(--tilw-hit);
  block-size: var(--tilw-hit);
  border: 1px solid var(--tilw-border-subtle);
  border-radius: 11px;
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
}
.back:hover {
  border-color: var(--tilw-border-strong);
}
.content {
  align-self: center;
  inline-size: min(456px, 100%);
  padding-block: var(--tilw-space-48);
}
.legal {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--tilw-space-12) var(--tilw-space-32);
  inline-size: min(456px, 100%);
  font: 400 13px/1.6 var(--tilw-font-ar);
}
.legal a {
  color: var(--tilw-text-muted);
  text-decoration: none;
}
.legal a:hover {
  color: var(--tilw-text-ink);
  text-decoration: underline;
}
.legal :deep(.locale) {
  margin-inline-start: auto;
}

@media (max-width: 860px) {
  .auth {
    grid-template-columns: minmax(0, 1fr);
    padding: 0 max(25px, env(safe-area-inset-left, 0px)) 0 max(25px, env(safe-area-inset-right, 0px));
  }
  .photo {
    display: none;
  }
  .col {
    padding-block: 25px calc(20px + env(safe-area-inset-bottom, 0px));
  }
  .top {
    inline-size: 100%;
  }
  .content {
    inline-size: 100%;
    align-self: start;
    padding-block: 86px var(--tilw-space-32);
  }
  .legal {
    inline-size: 100%;
  }
}
</style>
