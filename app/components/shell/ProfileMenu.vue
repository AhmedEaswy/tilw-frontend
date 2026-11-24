<script setup lang="ts">
/**
 * Profile button in the studio header (6:18) with an account menu: profile, settings, dark mode, back to the
 * website, sign out.
 * Figma draws only the initial; the menu itself has no frame yet (logged in gaps.md) and is built from the
 * design-system surfaces, switch and glyphs.
 * Keyboard: Enter/Space/↓ opens and focuses the first item, ↑/↓ move, Home/End jump, Esc closes and
 * returns focus to the button, Tab leaves the menu.
 */
const { t } = useI18n()
const auth = useAuthStore()
const prefs = usePrefsStore()
const { signOut, busy } = useSignOut()

const open = ref(false)
const root = ref<HTMLElement>()
const button = ref<HTMLButtonElement>()
const menu = ref<HTMLElement>()
const menuId = useId()

const initial = computed(() => auth.user?.name?.trim().charAt(0) ?? '·')

// Release 2 (US2): Upgrade to Pro from the account menu (Free only).
const plan = usePlanStore()
const upgrade = useUpgrade()
function openUpgrade() {
  open.value = false
  upgrade.open()
}

// Effective theme: an explicit choice, or the system setting when none is saved.
const systemDark = usePreferredDark()
const dark = computed(() => (prefs.theme === 'system' ? systemDark.value : prefs.theme === 'dark'))
function toggleTheme() {
  prefs.setTheme(dark.value ? 'light' : 'dark')
}

const items = () => [...(menu.value?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])]
function focusItem(i: number) {
  const list = items()
  if (!list.length) return
  list[(i + list.length) % list.length]!.focus()
}

async function show(focus: 'first' | 'last' | null = 'first') {
  open.value = true
  await nextTick()
  if (focus) focusItem(focus === 'first' ? 0 : -1)
}
function hide(returnFocus = true) {
  if (!open.value) return
  open.value = false
  if (returnFocus) button.value?.focus()
}

function onButtonKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    void show('first')
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    void show('last')
  }
}
function onMenuKey(e: KeyboardEvent) {
  const list = items()
  const i = list.indexOf(document.activeElement as HTMLElement)
  if (e.key === 'ArrowDown') focusItem(i + 1)
  else if (e.key === 'ArrowUp') focusItem(i - 1)
  else if (e.key === 'Home') focusItem(0)
  else if (e.key === 'End') focusItem(-1)
  else if (e.key === 'Escape') hide()
  else if (e.key === 'Tab') return hide(false)
  else return
  e.preventDefault()
}

onClickOutside(root, () => hide(false))
// Close when navigating with one of the links.
const route = useRoute()
watch(() => route.fullPath, () => hide(false))

async function onSignOut() {
  hide(false)
  await signOut()
}
</script>

<template>
  <div ref="root" class="pm">
    <button
      ref="button"
      type="button"
      class="avatar"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="open ? menuId : undefined"
      :aria-label="t('nav.account', { name: auth.user?.name ?? '' })"
      @click="open ? hide() : show(null)"
      @keydown="onButtonKey"
    >{{ initial }}</button>

    <div v-if="open" :id="menuId" ref="menu" class="menu" role="menu" :aria-label="t('nav.account', { name: auth.user?.name ?? '' })" @keydown="onMenuKey">
      <div class="who">
        <span class="badge" aria-hidden="true">{{ initial }}</span>
        <span class="id">
          <b>{{ auth.user?.name }}</b>
          <small dir="ltr">{{ auth.user?.email }}</small>
        </span>
      </div>
      <hr>
      <NuxtLink to="/app/settings/account" class="item" role="menuitem" tabindex="-1">
        <UiGlyph name="edit" :size="18" />{{ t('nav.profile') }}
      </NuxtLink>
      <NuxtLink to="/app/settings" class="item" role="menuitem" tabindex="-1">
        <UiGlyph name="settings" :size="18" />{{ t('nav.settings') }}
      </NuxtLink>
      <button v-if="plan.my && !plan.isPro" type="button" class="item" role="menuitem" tabindex="-1" @click="openUpgrade">
        <UiGlyph name="up" :size="18" />{{ t('upgrade.cta') }}
      </button>
      <button type="button" class="item" role="menuitemcheckbox" :aria-checked="dark" tabindex="-1" @click="toggleTheme">
        <UiGlyph name="sun" :size="18" />
        <span class="grow">{{ t('nav.darkMode') }}</span>
        <span class="track" :class="{ on: dark }" aria-hidden="true"><span class="thumb" /></span>
      </button>
      <hr>
      <NuxtLink to="/" class="item" role="menuitem" tabindex="-1">
        <UiGlyph name="back" :size="18" />{{ t('nav.backToSite') }}
      </NuxtLink>
      <button type="button" class="item out" role="menuitem" tabindex="-1" :disabled="busy" @click="onSignOut">
        <UiGlyph name="arrow-back" :size="18" />{{ t('auth.signOut') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.pm {
  position: relative;
  margin-inline-start: auto;
}
.avatar {
  display: grid;
  place-items: center;
  inline-size: 38px;
  block-size: 38px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--tilw-surface-quiet);
  color: var(--tilw-text-ink);
  font: 500 20px/1 var(--tilw-font-ar);
  cursor: pointer;
  transition: box-shadow 0.15s;
}
.avatar:hover,
.avatar[aria-expanded='true'] {
  box-shadow: 0 0 0 2px var(--tilw-border-strong);
}
.avatar:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}

.menu {
  position: absolute;
  inset-block-start: calc(100% + 10px);
  inset-inline-end: 0;
  z-index: 40;
  display: grid;
  gap: 2px;
  inline-size: 260px;
  max-inline-size: calc(100vw - 32px);
  padding: 8px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: var(--tilw-radius-control);
  background: var(--tilw-surface-white);
  box-shadow: var(--tilw-shadow-pop);
}
.who {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 8px 10px;
}
.badge {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  inline-size: 40px;
  block-size: 40px;
  border-radius: 50%;
  background: var(--tilw-surface-selected);
  color: var(--tilw-action-primary);
  font: 500 20px/1 var(--tilw-font-ar);
}
.id {
  display: grid;
  min-inline-size: 0;
}
.id b {
  overflow: hidden;
  font: 500 16px/1.36 var(--tilw-font-ar);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.id small {
  overflow: hidden;
  color: var(--tilw-text-muted);
  font: 400 13px/1.4 var(--tilw-font-lat);
  text-align: end;
  text-overflow: ellipsis;
  white-space: nowrap;
}
:dir(ltr) .id small {
  text-align: start;
}
hr {
  margin: 4px 6px;
  border: 0;
  border-block-start: 1px solid var(--tilw-border-subtle);
}
.item {
  display: flex;
  align-items: center;
  gap: 10px;
  inline-size: 100%;
  min-block-size: var(--tilw-hit);
  padding-inline: 10px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--tilw-text-ink);
  font: var(--tilw-type-label);
  text-align: start;
  text-decoration: none;
  cursor: pointer;
}
.item:hover,
.item:focus-visible {
  background: var(--tilw-surface-quiet);
  outline: none;
}
.item:focus-visible {
  box-shadow: inset 0 0 0 2px var(--tilw-focus-ring);
}
.item :deep(.ui-glyph) {
  color: var(--tilw-text-muted);
}
.item.out {
  color: var(--tilw-status-error);
}
.item.out :deep(.ui-glyph) {
  color: currentColor;
}
.item:disabled {
  opacity: 0.5;
  cursor: default;
}
.grow {
  flex: 1;
}
/* Same look as UiSwitch (5:126), drawn inline because the whole row is the control. */
.track {
  position: relative;
  flex: 0 0 auto;
  inline-size: 40px;
  block-size: 22px;
  border-radius: 11px;
  background: var(--tilw-border-strong);
  transition: background-color 0.2s;
}
.track.on {
  background: var(--tilw-action-primary);
}
.thumb {
  position: absolute;
  inset-block-start: 3px;
  inset-inline-start: 3px;
  inline-size: 16px;
  block-size: 16px;
  border-radius: 50%;
  background: var(--tilw-text-on-solid);
  transition: inset-inline-start 0.2s;
}
.track.on .thumb {
  inset-inline-start: 21px;
}
@media (prefers-reduced-motion: reduce) {
  .track,
  .thumb,
  .avatar {
    transition: none;
  }
}
</style>
