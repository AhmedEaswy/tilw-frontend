<script setup lang="ts">
/**
 * Header button that opens a menu of the person's recordings; picking one plays it in the floating mini player
 * without opening the take page. Built like ProfileMenu (same surface, keyboard: ↓/↑ walk the list, Home/End
 * jump, Esc closes and returns focus, Tab leaves). A search field filters by script title once there are many.
 */
import type { TakeMeta } from '~/services/takes'

const { t } = useI18n()
const takes = useTakesStore()
const player = usePlayerStore()
const num = useTakeNumber()

const open = ref(false)
const root = ref<HTMLElement>()
const button = ref<HTMLButtonElement>()
const menu = ref<HTMLElement>()
const menuId = useId()
const q = ref('')
const failed = ref(false)

async function ensureLoaded() {
  if (takes.loaded) return
  try {
    await takes.load()
    void takes.loadRemote().catch(() => {})
  } catch {
    failed.value = true
  }
}

const list = computed(() => {
  const s = q.value.trim().toLowerCase()
  const all = takes.all.filter(x => !x.remote || x.remote.state !== 'unreachable')
  return s ? all.filter(x => x.scriptTitle.toLowerCase().includes(s) || (x.label ?? '').toLowerCase().includes(s)) : all
})
const showSearch = computed(() => takes.all.length > 6)

function line(x: TakeMeta) {
  const kind = x.kind === 'video' ? t('recordings.video') : t('recordings.audio')
  return [x.driveOnly ? t('uploads.place.driveOnly') : t('recordings.take', { n: num(x.number) }), kind, formatDuration(x.durationMs)].join('  ·  ')
}

const items = () => [...(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
function focusItem(i: number) {
  const l = items()
  if (!l.length) return
  l[(i + l.length) % l.length]!.focus()
}
async function show(focus: 'first' | 'last' | null = null) {
  open.value = true
  q.value = ''
  await ensureLoaded()
  await nextTick()
  if (focus) focusItem(focus === 'first' ? 0 : -1)
}
function hide(returnFocus = true) {
  if (!open.value) return
  open.value = false
  if (returnFocus) button.value?.focus()
}
function onButtonKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    void show(e.key === 'ArrowDown' ? 'first' : 'last')
  }
}
function onMenuKey(e: KeyboardEvent) {
  const l = items()
  const i = l.indexOf(document.activeElement as HTMLElement)
  if (e.key === 'ArrowDown') focusItem(i + 1)
  else if (e.key === 'ArrowUp') focusItem(i < 0 ? -1 : i - 1)
  else if ((e.key === 'Home' || e.key === 'End') && i >= 0) focusItem(e.key === 'Home' ? 0 : -1)
  else if (e.key === 'Escape') hide()
  else if (e.key === 'Tab') return hide(false)
  else return
  e.preventDefault()
}
onClickOutside(root, () => hide(false))
const route = useRoute()
watch(() => route.fullPath, () => hide(false))

function pick(x: TakeMeta) {
  hide()
  void player.play(x)
}
</script>

<template>
  <div ref="root" class="pp">
    <button
      ref="button"
      type="button"
      class="trigger"
      :class="{ live: player.take }"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="open ? menuId : undefined"
      :aria-label="t('player.pickTitle')"
      data-testid="player-picker"
      @click="open ? hide() : show()"
      @keydown="onButtonKey"
    >
      <UiGlyph name="headset" :size="18" />
      <span class="lbl">{{ t('player.listen') }}</span>
      <span v-if="player.playing" class="eq" aria-hidden="true"><i /><i /><i /></span>
      <UiGlyph class="chev" name="chevron-down" :size="14" />
    </button>

    <div v-if="open" :id="menuId" ref="menu" class="menu" role="menu" :aria-label="t('player.pickTitle')" @keydown="onMenuKey">
      <p class="h">{{ t('player.pickTitle') }}</p>
      <input v-if="showSearch" v-model="q" class="search" type="search" :placeholder="t('player.search')" :aria-label="t('player.search')">
      <div class="scroll">
        <p v-if="!takes.loaded && !failed" class="note">{{ t('player.loading') }}</p>
        <p v-else-if="failed" class="note">{{ t('recordings.loadFailed') }}</p>
        <p v-else-if="!list.length" class="note">{{ takes.all.length ? t('player.noMatch') : t('player.none') }}</p>
        <button
          v-for="x in list"
          :key="x.id"
          type="button"
          class="item"
          role="menuitem"
          tabindex="-1"
          :aria-current="player.take?.id === x.id ? 'true' : undefined"
          @click="pick(x)"
        >
          <span class="kind" :class="x.kind"><UiGlyph :name="x.kind === 'video' ? 'video' : 'mic'" :size="18" /></span>
          <span class="txt">
            <b>{{ x.scriptTitle }}</b>
            <small>{{ line(x) }}</small>
          </span>
          <span v-if="player.take?.id === x.id" class="now">{{ t('player.nowPlaying') }}</span>
          <UiGlyph v-else class="go" name="play" :size="16" />
        </button>
      </div>
      <NuxtLink v-if="takes.all.length" to="/app/recordings" class="all">{{ t('recordings.all') }}</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.pp {
  position: relative;
  margin-inline-start: auto;
}
.trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  block-size: 38px;
  padding-inline: 12px 10px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: var(--tilw-radius-pill);
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
  font: var(--tilw-type-label);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.trigger:hover,
.trigger[aria-expanded='true'] {
  border-color: var(--tilw-border-strong);
}
.trigger.live {
  color: var(--tilw-action-primary);
}
.trigger:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
.chev {
  color: var(--tilw-text-muted);
}
.eq {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  block-size: 12px;
}
.eq i {
  inline-size: 3px;
  border-radius: 1px;
  background: currentColor;
  animation: eq 0.9s ease-in-out infinite;
}
.eq i:nth-child(2) {
  animation-delay: -0.3s;
}
.eq i:nth-child(3) {
  animation-delay: -0.6s;
}
@keyframes eq {
  0%, 100% { block-size: 4px; }
  50% { block-size: 12px; }
}

.menu {
  position: absolute;
  inset-block-start: calc(100% + 10px);
  inset-inline-end: 0;
  z-index: 40;
  display: grid;
  gap: 6px;
  inline-size: 360px;
  max-inline-size: calc(100vw - 32px);
  padding: 8px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: var(--tilw-radius-control);
  background: var(--tilw-surface-white);
  box-shadow: var(--tilw-shadow-pop);
}
.h {
  margin: 0;
  padding: 6px 8px 2px;
  color: var(--tilw-text-muted);
  font: var(--tilw-type-meta);
}
.search {
  block-size: 40px;
  margin-inline: 2px;
  padding-inline: 12px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: var(--tilw-radius-field);
  background: var(--tilw-surface-paper);
  color: var(--tilw-text-ink);
  font: var(--tilw-type-label);
}
.search:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 0;
}
.scroll {
  display: grid;
  gap: 2px;
  max-block-size: min(380px, 60dvh);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.note {
  margin: 0;
  padding: 14px 8px;
  color: var(--tilw-text-muted);
  font: var(--tilw-type-label);
}
.item {
  display: flex;
  align-items: center;
  gap: 12px;
  inline-size: 100%;
  min-block-size: 58px;
  padding: 6px 10px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--tilw-text-ink);
  text-align: start;
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
.item[aria-current='true'] {
  background: var(--tilw-surface-selected);
}
.kind {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  inline-size: 38px;
  block-size: 38px;
  border-radius: 9px;
  background: var(--tilw-surface-sage);
  color: var(--tilw-text-ink);
}
.kind.audio {
  background: var(--tilw-surface-selected);
  color: var(--tilw-action-primary);
}
.txt {
  display: grid;
  flex: 1;
  min-inline-size: 0;
}
.txt b {
  overflow: hidden;
  /* Titles keep their own direction but line up with the rest of the row. */
  text-align: left;
  unicode-bidi: plaintext;
  font: 500 16px/1.4 var(--tilw-font-ar);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.txt small {
  overflow: hidden;
  color: var(--tilw-text-muted);
  font: 400 13px/1.4 var(--tilw-font-ar);
  text-overflow: ellipsis;
  white-space: pre;
}
.go {
  color: var(--tilw-action-primary);
}
.now {
  flex: 0 0 auto;
  padding: 0 8px;
  border-radius: 9px;
  background: var(--tilw-stage-cue);
  color: var(--tilw-stage-background);
  font: 500 12px/20px var(--tilw-font-ar);
}
.all {
  padding: 8px 10px 4px;
  border-block-start: 1px solid var(--tilw-border-subtle);
  color: var(--tilw-action-primary);
  font: var(--tilw-type-label);
  text-decoration: none;
}
.all:hover {
  text-decoration: underline;
}

@media (max-width: 760px) {
  .trigger {
    inline-size: 38px;
    padding: 0;
    justify-content: center;
  }
  .lbl,
  .chev,
  .eq {
    display: none;
  }
  .menu {
    position: fixed;
    inset-block-start: 72px;
    inset-inline: 12px;
    inline-size: auto;
    max-inline-size: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .eq i {
    animation: none;
    block-size: 8px;
  }
}
:dir(rtl) .txt b {
  text-align: right;
}
</style>
