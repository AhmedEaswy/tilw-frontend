<script setup lang="ts">
/**
 * Admin console layout (feature 006, Figma D1 `308:404`, D12 `316:2114`, narrow D14 `317:2221` / `317:2318`):
 * a fixed side rail on the inline-start side with the sections, a top bar with the people search, the environment
 * badge, a link back to the studio and the admin's menu. From 1024px the rail collapses to icons or expands from the
 * button beside the logo (remembered in this browser); with no choice made it is full from 1280px and icons below.
 * Under 1024px it is a drawer.
 */
import '~/assets/css/admin.css'
import type { GlyphName } from '~/components/ui/UiGlyph.vue'
import type { AdminSection } from '~/services/types'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()
const mockMode = config.public.servicesMode === 'mock'

// Feature 007: each item names the section it needs (null = any admin); sections the admin can't view are hidden.
const { can } = useAdminPermissions()
type NavItem = { to: string; key: string; icon: GlyphName; section: AdminSection | null; need?: 'view' | 'edit' }
const allGroups: { key: string; items: NavItem[] }[] = [
  { key: 'overview', items: [
    { to: '/admin', key: 'dashboard', icon: 'expand', section: null },
    { to: '/admin/analytics', key: 'analytics', icon: 'up', section: 'users' },
  ] },
  { key: 'people', items: [
    { to: '/admin/users', key: 'users', icon: 'privacy', section: 'users' },
    { to: '/admin/waitlist', key: 'waitlist', icon: 'clock', section: 'users' },
    { to: '/admin/invitations', key: 'invitations', icon: 'mail', section: 'users' },
  ] },
  { key: 'money', items: [
    { to: '/admin/plans', key: 'plans', icon: 'file', section: 'plans' },
    { to: '/admin/subscriptions', key: 'subscriptions', icon: 'pin', section: 'money' },
    { to: '/admin/payments', key: 'payments', icon: 'check', section: 'money' },
  ] },
  { key: 'ai', items: [
    { to: '/admin/ai/usage', key: 'usage', icon: 'sun', section: 'ai' },
    { to: '/admin/ai/calls', key: 'calls', icon: 'keyboard', section: 'ai' },
    { to: '/admin/ai/ledger', key: 'ledger', icon: 'archive', section: 'ai' },
  ] },
  { key: 'system', items: [
    { to: '/admin/audit', key: 'audit', icon: 'edit', section: 'audit' },
    { to: '/admin/settings', key: 'settings', icon: 'settings', section: 'settings' },
    // Every /admin/admins route needs admins: edit, reads too.
    { to: '/admin/admins', key: 'admins', icon: 'field-lock', section: 'admins', need: 'edit' },
  ] },
]
const groups = computed(() => allGroups
  .map(g => ({ ...g, items: g.items.filter(i => !i.section || can(i.section, i.need ?? 'view')) }))
  .filter(g => g.items.length))
const isCurrent = (to: string) => (to === '/admin' ? route.path.replace(/\/$/, '') === '/admin' : route.path === to || route.path.startsWith(`${to}/`))

const env = computed(() => {
  if (mockMode) return { label: t('admin.env.demo'), tone: 'info' }
  const e = String(config.public.environment || 'local')
  return e === 'production' ? { label: t('admin.env.production'), tone: 'error' } : e === 'staging' ? { label: t('admin.env.staging'), tone: 'warning' } : { label: t('admin.env.local'), tone: 'neutral' }
})

const search = ref(typeof route.query.q === 'string' && route.path === '/admin/users' ? route.query.q : '')
function find() {
  const q = search.value.trim()
  void router.push({ path: '/admin/users', query: q ? { q } : {} })
}

// Rail size from 1024px: the admin's choice, else full from 1280px and icons below (the CSS default, so no flash).
// Both are read after mount so the first client render matches the server's.
const railPref = useLocalStorage<'mini' | 'full' | null>('tilw-admin-rail', null, { initOnMounted: true })
const mounted = useMounted()
const midWidth = useMediaQuery('(max-width: 1279px)')
const railMini = computed(() => railPref.value === 'mini' || (railPref.value !== 'full' && mounted.value && midWidth.value))
const toggleRail = () => (railPref.value = railMini.value ? 'full' : 'mini')

const drawer = ref(false)
watch(() => route.fullPath, () => (drawer.value = false))
useHead({ htmlAttrs: { class: 'adm-html' } })
</script>

<template>
  <div class="adm-shell" :class="{ open: drawer, 'rail-mini': railPref === 'mini', 'rail-full': railPref === 'full' }">
    <a href="#adm-main" class="skip">{{ t('admin.skip') }}</a>
    <aside class="rail" :aria-label="t('admin.title')">
      <div class="brand">
        <NuxtLink to="/admin" class="logo" :aria-label="t('admin.title')"><BrandSignature :width="138" /></NuxtLink>
        <button
          type="button"
          class="fold"
          :aria-label="railMini ? t('admin.rail.expand') : t('admin.rail.collapse')"
          :title="railMini ? t('admin.rail.expand') : t('admin.rail.collapse')"
          :aria-expanded="!railMini"
          data-testid="rail-toggle"
          @click="toggleRail"
        >
          <UiGlyph :name="railMini ? 'expand' : 'menu'" :size="18" />
        </button>
        <span class="tag">{{ t('admin.title') }}</span>
        <button type="button" class="close" :aria-label="t('common.close')" @click="drawer = false"><UiGlyph name="close" :size="20" /></button>
      </div>
      <nav :aria-label="t('admin.title')">
        <div v-for="g in groups" :key="g.key" class="grp">
          <p class="gl">{{ t(`admin.nav.${g.key}`) }}</p>
          <NuxtLink
            v-for="i in g.items"
            :key="i.to"
            :to="i.to"
            class="item"
            :aria-current="isCurrent(i.to) ? 'page' : undefined"
            :title="t(`admin.nav.${i.key}`)"
          >
            <UiGlyph :name="i.icon" :size="18" />
            <span class="lbl">{{ t(`admin.nav.${i.key}`) }}</span>
          </NuxtLink>
        </div>
      </nav>
    </aside>
    <div v-if="drawer" class="scrim" aria-hidden="true" @click="drawer = false" />

    <div class="main">
      <header class="top">
        <button type="button" class="burger" :aria-label="t('admin.menu')" :aria-expanded="drawer" @click="drawer = !drawer"><UiGlyph name="menu" :size="22" /></button>
        <form role="search" class="find" @submit.prevent="find">
          <UiGlyph name="search" :size="16" />
          <input v-model="search" type="search" dir="auto" :placeholder="t('admin.topSearch')" :aria-label="t('admin.topSearch')">
        </form>
        <span class="adm-chip env" :class="env.tone" data-testid="env-badge">{{ env.label }}</span>
        <NuxtLink to="/app/scripts" class="adm-btn ghost">{{ t('admin.backToStudio') }}</NuxtLink>
        <AdminAccountMenu />
      </header>
      <main id="adm-main" tabindex="-1">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.adm-shell {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  min-block-size: 100dvh;
  background: var(--tilw-surface-paper);
  transition: grid-template-columns 0.2s;
}
.skip {
  position: absolute;
  inset-inline-start: -9999px;
}
.skip:focus {
  inset-inline-start: 8px;
  inset-block-start: 8px;
  z-index: 50;
  padding: 8px 12px;
  background: var(--tilw-surface-white);
}
.rail {
  position: sticky;
  inset-block-start: 0;
  block-size: 100dvh;
  overflow-y: auto;
  padding: 20px 16px;
  border-inline-end: 1px solid var(--tilw-border-subtle);
  background: var(--tilw-surface-white);
}
.brand {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px 8px;
  padding: 4px 8px 16px;
}
.brand .tag {
  grid-column: 1 / -1;
}
.fold {
  display: inline-grid;
  place-items: center;
  inline-size: 32px;
  block-size: 32px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--tilw-text-muted);
  cursor: pointer;
}
.fold:hover {
  background: var(--tilw-surface-quiet);
  color: var(--tilw-text-ink);
}
.fold:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
.brand .tag {
  color: var(--tilw-action-primary);
  font: 600 12px/1.4 var(--tilw-font-ar);
}
.brand .close {
  display: none;
}
.grp {
  display: grid;
  gap: 2px;
  padding-block-start: 12px;
}
.gl {
  padding-inline: 12px;
  color: var(--tilw-text-muted);
  font: 600 11px/1.6 var(--tilw-font-ar);
}
.item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-block-size: 40px;
  padding: 8px 12px;
  border-radius: 10px;
  color: var(--tilw-text-ink);
  font: 500 14px/1.3 var(--tilw-font-ar);
  text-decoration: none;
}
.item :deep(svg),
.item :deep(.glyph) {
  color: var(--tilw-text-muted);
}
.item:hover {
  background: var(--tilw-surface-quiet);
}
.item[aria-current='page'] {
  background: var(--tilw-surface-selected);
  color: var(--tilw-action-primary);
  font-weight: 600;
}
.item[aria-current='page'] :deep(svg),
.item[aria-current='page'] :deep(.glyph) {
  color: var(--tilw-action-primary);
}
.main {
  min-inline-size: 0;
}
.top {
  position: sticky;
  inset-block-start: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  block-size: 60px;
  padding-inline: 32px;
  border-block-end: 1px solid var(--tilw-border-subtle);
  background: var(--tilw-surface-white);
}
.burger {
  display: none;
  border: 0;
  background: none;
  color: var(--tilw-text-ink);
  cursor: pointer;
}
.find {
  display: flex;
  align-items: center;
  gap: 8px;
  inline-size: min(380px, 100%);
  block-size: 36px;
  padding-inline: 12px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: 10px;
  margin-inline-end: auto;
  color: var(--tilw-text-muted);
}
.find input {
  flex: 1;
  min-inline-size: 0;
  border: 0;
  background: none;
  color: var(--tilw-text-ink);
  font: 500 14px/1 var(--tilw-font-ar);
  outline: none;
}
.find:focus-within {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
main:focus {
  outline: none;
}
.scrim {
  display: none;
}

/* Icon rail (labels as tooltips and accessible names): chosen from 1024px, or the default at 1024–1279px. */
@media (min-width: 1024px) {
  .adm-shell.rail-mini {
    grid-template-columns: 64px minmax(0, 1fr);
  }
  .rail-mini .rail {
    padding: 20px 12px;
  }
  .rail-mini .brand {
    grid-template-columns: 1fr;
    justify-items: center;
    padding-inline: 0;
  }
  .rail-mini .logo,
  .rail-mini .tag,
  .rail-mini .gl,
  .rail-mini .lbl {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .rail-mini .item {
    justify-content: center;
    padding: 8px;
  }
}
@media (max-width: 1279px) and (min-width: 1024px) {
  .adm-shell:not(.rail-full) {
    grid-template-columns: 64px minmax(0, 1fr);
  }
  .adm-shell:not(.rail-full) .rail {
    padding: 20px 12px;
  }
  .adm-shell:not(.rail-full) .brand {
    grid-template-columns: 1fr;
    justify-items: center;
    padding-inline: 0;
  }
  .adm-shell:not(.rail-full) :is(.logo, .tag, .gl, .lbl) {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .adm-shell:not(.rail-full) .item {
    justify-content: center;
    padding: 8px;
  }
}

/* Under 1024px: the rail becomes a drawer opened from the top bar. */
@media (max-width: 1023px) {
  .adm-shell {
    grid-template-columns: minmax(0, 1fr);
  }
  .rail {
    position: fixed;
    inset-block: 0;
    inset-inline-start: 0;
    z-index: 40;
    inline-size: 260px;
    transform: translateX(-110%);
    transition: transform 0.2s;
  }
  :dir(rtl) .rail {
    transform: translateX(110%);
  }
  .open .rail {
    transform: none;
  }
  .fold {
    display: none;
  }
  .brand .close {
    display: inline-flex;
    grid-row: 1;
    grid-column: 2;
    border: 0;
    background: none;
    cursor: pointer;
  }
  .scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 30;
    background: var(--tilw-scrim);
  }
  .burger {
    display: inline-flex;
  }
  .top {
    padding-inline: 16px;
  }
  .top .adm-btn.ghost {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .adm-shell,
  .rail {
    transition: none;
  }
}
</style>
