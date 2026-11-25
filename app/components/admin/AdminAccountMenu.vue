<script setup lang="ts">
/**
 * The admin console's account menu (top bar): name / email, settings, appearance (System / Light / Dark), language
 * (العربية / English), open the website in a new tab, sign out. Mirrors the studio's `shell/ProfileMenu.vue`:
 * appearance and language apply at once and are saved to the account (`useThemeChoice` / `useLocaleChoice`); both are
 * `menuitemradio` groups, so ↑/↓ walk through every option and Enter/Space picks one without closing the menu.
 * Keyboard: Enter/Space/↓ opens and focuses the first item, ↑ the last; ↑/↓ move, Home/End jump, Esc closes and
 * returns focus to the button, Tab leaves the menu.
 */
const { t } = useI18n()
const auth = useAuthStore()
const { signOut, busy } = useSignOut()

const open = ref(false)
const root = ref<HTMLElement>()
const button = ref<HTMLButtonElement>()
const menu = ref<HTMLElement>()
const menuId = useId()

const initials = computed(() => (auth.user?.name ?? '').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('') || '?')

const { theme, choose: chooseTheme } = useThemeChoice()
const { locale, options: languages, choose: chooseLocale } = useLocaleChoice()
const themes = computed(() => [
  { value: 'system' as const, label: t('menu.themeSystem') },
  { value: 'light' as const, label: t('settings.themeLight') },
  { value: 'dark' as const, label: t('settings.themeDark') },
])

const items = () => [...(menu.value?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)') ?? [])]
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
const route = useRoute()
watch(() => route.fullPath, () => hide(false))

async function onSignOut() {
  hide(false)
  await signOut()
}
</script>

<template>
  <div ref="root" class="me">
    <button
      ref="button"
      type="button"
      class="av"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="open ? menuId : undefined"
      :aria-label="t('admin.accountMenu')"
      data-testid="admin-account"
      @click="open ? hide() : show(null)"
      @keydown="onButtonKey"
    >{{ initials }}</button>

    <div v-if="open" :id="menuId" ref="menu" class="pop" role="menu" :aria-label="t('admin.accountMenu')" @keydown="onMenuKey">
      <p class="who"><b>{{ auth.user?.name }}</b><small class="adm-ltr">{{ auth.user?.email }}</small></p>
      <hr>
      <NuxtLink to="/app/settings" class="item" role="menuitem" tabindex="-1">
        <UiGlyph name="settings" :size="18" />{{ t('nav.settings') }}
      </NuxtLink>
      <hr>
      <div class="choice" role="group" :aria-label="t('menu.appearance')" data-testid="admin-menu-theme">
        <span class="choice-h" aria-hidden="true"><UiGlyph name="sun" :size="18" />{{ t('menu.appearance') }}</span>
        <div class="seg">
          <button
            v-for="th in themes"
            :key="th.value"
            type="button"
            role="menuitemradio"
            :aria-checked="theme === th.value"
            tabindex="-1"
            @click="chooseTheme(th.value)"
          >{{ th.label }}</button>
        </div>
      </div>
      <div class="choice" role="group" :aria-label="t('menu.language')" data-testid="admin-menu-language">
        <span class="choice-h" aria-hidden="true"><UiGlyph name="language" :size="18" />{{ t('menu.language') }}</span>
        <div class="seg">
          <button
            v-for="l in languages"
            :key="l.code"
            type="button"
            role="menuitemradio"
            :lang="l.code"
            :class="{ lat: l.code === 'en' }"
            :aria-checked="locale === l.code"
            tabindex="-1"
            @click="chooseLocale(l.code)"
          >{{ l.name }}</button>
        </div>
      </div>
      <hr>
      <a href="/" target="_blank" rel="noopener" class="item" role="menuitem" tabindex="-1" @click="hide(false)">
        <UiGlyph name="back" :size="18" />{{ t('admin.openSite') }}<span class="sr">({{ t('admin.newTab') }})</span>
      </a>
      <button type="button" class="item out" role="menuitem" tabindex="-1" :disabled="busy" @click="onSignOut">
        <UiGlyph name="arrow-back" :size="18" />{{ t('auth.signOut') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.me {
  position: relative;
}
.av {
  inline-size: 32px;
  block-size: 32px;
  border: 0;
  border-radius: 50%;
  background: var(--tilw-surface-selected);
  color: var(--tilw-action-primary);
  font: 600 12px/1 var(--tilw-font-ar);
  cursor: pointer;
}
.av:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
.pop {
  position: absolute;
  inset-inline-end: 0;
  inset-block-start: 40px;
  z-index: 40;
  display: grid;
  gap: 2px;
  inline-size: 272px;
  max-inline-size: calc(100vw - 32px);
  padding: 8px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: 12px;
  background: var(--tilw-surface-white);
  box-shadow: var(--tilw-shadow-pop);
}
.who {
  display: grid;
  min-inline-size: 0;
  padding: 6px 8px 8px;
  font: 500 13px/1.4 var(--tilw-font-ar);
}
.who b,
.who small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.who small {
  color: var(--tilw-text-muted);
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
  min-block-size: 40px;
  padding-inline: 10px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--tilw-text-ink);
  font: 500 14px/1.3 var(--tilw-font-ar);
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
.sr {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.choice {
  display: grid;
  gap: 6px;
  padding: 6px 10px 8px;
}
.choice-h {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--tilw-text-muted);
  font: 500 14px/1.3 var(--tilw-font-ar);
}
.seg {
  display: flex;
  padding: 3px;
  border-radius: 10px;
  background: var(--tilw-surface-quiet);
}
.seg button {
  flex: 1;
  min-inline-size: 0;
  min-block-size: 32px;
  padding-inline: 6px;
  border: 0;
  border-radius: 7px;
  background: none;
  color: var(--tilw-text-muted);
  font: 500 14px/1.2 var(--tilw-font-ar);
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}
.seg button.lat {
  font-family: var(--tilw-font-lat);
}
.seg button:hover {
  color: var(--tilw-text-ink);
}
.seg button[aria-checked='true'] {
  background: var(--tilw-surface-white);
  color: var(--tilw-action-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}
.seg button:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 1px;
}
@media (prefers-reduced-motion: reduce) {
  .seg button {
    transition: none;
  }
}
</style>
