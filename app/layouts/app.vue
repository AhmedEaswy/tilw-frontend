<script setup lang="ts">
/**
 * Studio shell (Figma 6:18 desktop, 6:20 phone): 76px header with signature, section nav
 * (نصوصي · تسجيلاتي · الإعدادات) with a copper underline on the current section, and the profile
 * initial, which opens the account menu (ProfileMenu). On phones the nav moves to a bottom tab bar with glyphs.
 */
import type { GlyphName } from '~/components/ui/UiGlyph.vue'

const { t } = useI18n()
const route = useRoute()

const sections: { to: string; key: string; icon: GlyphName }[] = [
  { to: '/app/scripts', key: 'nav.scripts', icon: 'file' },
  { to: '/app/recordings', key: 'nav.recordings', icon: 'video' },
  { to: '/app/settings', key: 'nav.settings', icon: 'settings' },
]
const isCurrent = (to: string) => route.path === to || route.path.startsWith(`${to}/`)
</script>

<template>
  <div class="shell" :class="{ 'phone-minimal': route.meta.phoneMinimal }">
    <header class="hdr">
      <div class="in">
        <NuxtLink to="/app/scripts" class="brand" :aria-label="t('nav.scripts')"><BrandSignature :width="143" /></NuxtLink>
        <nav class="top-nav" :aria-label="t('nav.main')">
          <NuxtLink
            v-for="s in sections"
            :key="s.to"
            :to="s.to"
            :aria-current="isCurrent(s.to) ? 'page' : undefined"
          >{{ t(s.key) }}</NuxtLink>
        </nav>
        <ProfileMenu />
      </div>
    </header>

    <main class="main"><slot /></main>

    <nav class="tabs" :aria-label="t('nav.main')">
      <NuxtLink
        v-for="s in sections"
        :key="s.to"
        :to="s.to"
        :aria-current="isCurrent(s.to) ? 'page' : undefined"
      >
        <UiGlyph :name="s.icon" :size="22" />
        <span>{{ t(s.key) }}</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<style scoped>
.shell {
  min-block-size: 100dvh;
  background: var(--tilw-surface-paper);
  color: var(--tilw-text-ink);
}
.hdr {
  position: sticky;
  inset-block-start: 0;
  z-index: 20;
  block-size: var(--tilw-header-h);
  border-block-end: 1px solid var(--tilw-border-subtle);
  background: var(--tilw-surface-paper);
}
.in {
  display: flex;
  align-items: center;
  gap: var(--tilw-space-32);
  block-size: 100%;
  inline-size: 100%;
  max-inline-size: calc(var(--tilw-content-max) + 116px);
  margin-inline: auto;
  padding-inline: max(58px, env(safe-area-inset-left, 0px)) max(58px, env(safe-area-inset-right, 0px));
}
.brand {
  display: flex;
}
.top-nav {
  display: flex;
  gap: 6px;
  margin-inline-start: 120px;
}
.top-nav a {
  position: relative;
  display: grid;
  place-items: center;
  min-inline-size: 100px;
  block-size: var(--tilw-header-h);
  color: var(--tilw-text-ink);
  font: var(--tilw-type-label);
  text-decoration: none;
}
.top-nav a:hover {
  color: var(--tilw-action-primary);
}
.top-nav a[aria-current='page'] {
  color: var(--tilw-action-primary);
}
.top-nav a[aria-current='page']::after {
  content: '';
  position: absolute;
  inset-block-end: 14px;
  inline-size: 28px;
  block-size: 3px;
  border-radius: 2px;
  background: var(--tilw-action-primary);
}
.main {
  inline-size: 100%;
  max-inline-size: calc(var(--tilw-content-max) + 116px);
  margin-inline: auto;
  padding: 0 max(58px, env(safe-area-inset-left, 0px)) 72px max(58px, env(safe-area-inset-right, 0px));
}
.tabs {
  display: none;
}

@media (max-width: 760px) {
  .hdr {
    block-size: 64px;
  }
  .in {
    max-inline-size: none;
    padding-inline: max(20px, env(safe-area-inset-left, 0px)) max(20px, env(safe-area-inset-right, 0px));
  }
  .top-nav {
    display: none;
  }
  /* Phone header (6:20): profile at the end, signature centered. */
  .brand {
    position: absolute;
    inset-inline-start: 50%;
    translate: 50% 0;
  }
  [dir='ltr'] .brand {
    translate: -50% 0;
  }
  .main {
    padding: 0 max(20px, env(safe-area-inset-left, 0px)) calc(96px + env(safe-area-inset-bottom, 0px)) max(20px, env(safe-area-inset-right, 0px));
  }
  .tabs {
    position: fixed;
    inset-inline: 0;
    inset-block-end: 0;
    z-index: 20;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    padding-block-end: env(safe-area-inset-bottom, 0px);
    border-block-start: 1px solid var(--tilw-border-subtle);
    background: var(--tilw-surface-paper);
  }
  .tabs a {
    display: grid;
    justify-items: center;
    gap: 4px;
    padding-block: 14px 12px;
    color: var(--tilw-text-ink);
    font: 500 14px/1.3 var(--tilw-font-ar);
    text-decoration: none;
  }
  .tabs a[aria-current='page'] {
    color: var(--tilw-action-primary);
  }
  .phone-minimal .hdr,
  .phone-minimal .tabs {
    display: none;
  }
  .phone-minimal .main {
    padding-block-end: 0;
  }
}
</style>
