<script setup lang="ts">
/**
 * Floating mini player (YouTube-style), mounted once in app.vue. A dark stage card with the take's details, a
 * copper play button, back/forward 10s and a seek line; a video take also shows the picture. The person can grab
 * the card anywhere outside its controls and drop it anywhere on the screen (mouse or touch); the grip button
 * also moves it with the arrow keys. The position is kept in this browser and stays inside the window when it
 * resizes. It hides (and pauses) outside the studio and while rehearsing or recording.
 */
const { t } = useI18n()
const player = usePlayerStore()
const auth = useAuthStore()
const route = useRoute()
const num = useTakeNumber()

const take = computed(() => player.take)
const isVideo = computed(() => take.value?.kind === 'video')
const allowed = computed(() => route.path.startsWith('/app') && !/\/(record|rehearse)(\/|$)/.test(route.path))
const visible = computed(() => !!take.value && allowed.value)

watch(allowed, (ok) => {
  if (!ok) player.pause()
})
watch(() => auth.user?.id, (id) => {
  if (!id) player.close()
})

// ---------- media ----------
const media = ref<HTMLVideoElement>()
watch(media, (m) => {
  player.el = m ?? null
}, { immediate: true })
onBeforeUnmount(() => {
  player.el = null
})

function applyPending() {
  const m = media.value
  const p = player.pending
  if (!m || !p) return
  player.pending = null
  if (p.at > 0) {
    m.currentTime = Math.min(p.at, player.duration || p.at)
    player.current = m.currentTime
  }
  if (p.autoplay) void m.play().catch(() => {})
}

function onMeta() {
  const m = media.value
  if (!m) return
  if (Number.isFinite(m.duration)) {
    player.duration = m.duration
    player.seekable = true
    applyPending()
    return
  }
  // MediaRecorder WebM files have no duration: make Chrome scan the file once (same as TakePlayer).
  const fix = () => {
    m.removeEventListener('timeupdate', fix)
    if (Number.isFinite(m.duration)) {
      player.duration = m.duration
      player.seekable = true
    }
    m.currentTime = 0
    applyPending()
  }
  m.addEventListener('timeupdate', fix)
  m.currentTime = 1e101
}
function onTime() {
  // Ignore the duration scan's jump to the end.
  if (!player.seekable && player.pending) return
  player.current = media.value?.currentTime ?? 0
}

const pct = computed(() => (player.duration ? Math.min(1, player.current / player.duration) : 0))
const fmt = (s: number) => formatDuration(s * 1000)
const meta = computed(() => {
  const x = take.value
  if (!x) return ''
  const kind = x.kind === 'video' ? t('recordings.video') : t('recordings.audio')
  return [x.driveOnly ? null : t('recordings.take', { n: num(x.number) }), x.label, kind].filter(Boolean).join('  ·  ')
})

// Lock-screen / headset controls.
watch(take, (x) => {
  if (!import.meta.client || !('mediaSession' in navigator) || !x) return
  navigator.mediaSession.metadata = new MediaMetadata({ title: x.scriptTitle, artist: meta.value, album: 'tilwprompter' })
  navigator.mediaSession.setActionHandler('play', () => player.resume())
  navigator.mediaSession.setActionHandler('pause', () => player.pause())
  navigator.mediaSession.setActionHandler('seekbackward', () => player.skip(-10))
  navigator.mediaSession.setActionHandler('seekforward', () => player.skip(10))
})

// ---------- drag anywhere ----------
const KEY = 'tilw.miniPlayer.pos'
const GAP = 12
const card = ref<HTMLElement>()
const { width: cw, height: ch } = useElementSize(card, undefined, { box: 'border-box' })
const { width: vw, height: vh } = useWindowSize()
const pos = ref<{ x: number; y: number } | null>(null)
const dragging = ref(false)
let start: { id: number; px: number; py: number; x: number; y: number } | null = null
let moved = false
let swallowClick = false

function clamp(p: { x: number; y: number }) {
  const maxX = Math.max(GAP, vw.value - cw.value - GAP)
  const maxY = Math.max(GAP, vh.value - ch.value - GAP)
  return { x: Math.round(Math.min(Math.max(p.x, GAP), maxX)), y: Math.round(Math.min(Math.max(p.y, GAP), maxY)) }
}
function fallback() {
  const rtl = document.documentElement.dir === 'rtl'
  const phone = vw.value <= 760
  // Bottom, at the end of the reading direction, clear of the phone tab bar.
  return { x: rtl ? GAP + 8 : vw.value - cw.value - GAP - 8, y: vh.value - ch.value - (phone ? 92 : GAP + 12) }
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(pos.value))
  } catch { /* private mode */ }
}
function restore(): { x: number; y: number } | null {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null
  } catch {
    return null
  }
}

// Place once the card has a size, and keep it on screen when the window or the card changes size.
watch([cw, ch, vw, vh], () => {
  if (!cw.value || !ch.value) return
  pos.value = clamp(pos.value ?? restore() ?? fallback())
})

function onDown(e: PointerEvent) {
  if (e.button !== 0 || !pos.value) return
  if ((e.target as HTMLElement).closest('a, input, button:not(.grip)')) return
  start = { id: e.pointerId, px: e.clientX, py: e.clientY, x: pos.value.x, y: pos.value.y }
  moved = false
}
useEventListener(window, 'pointermove', (e: PointerEvent) => {
  if (!start || e.pointerId !== start.id) return
  const dx = e.clientX - start.px
  const dy = e.clientY - start.py
  if (!moved && Math.hypot(dx, dy) < 5) return
  moved = true
  dragging.value = true
  e.preventDefault()
  pos.value = clamp({ x: start.x + dx, y: start.y + dy })
})
function onUp(e: PointerEvent) {
  if (!start || e.pointerId !== start.id) return
  start = null
  dragging.value = false
  if (moved) {
    save()
    swallowClick = true
    setTimeout(() => (swallowClick = false), 0)
  }
}
useEventListener(window, 'pointerup', onUp)
useEventListener(window, 'pointercancel', onUp)

function onScreenClick() {
  if (swallowClick) return
  player.toggle()
}

function onGripKey(e: KeyboardEvent) {
  if (!pos.value) return
  const step = e.shiftKey ? 96 : 24
  const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
  if (!d) return
  e.preventDefault()
  pos.value = clamp({ x: pos.value.x + d[0]!, y: pos.value.y + d[1]! })
  save()
}

const style = computed(() => (pos.value ? { transform: `translate3d(${pos.value.x}px, ${pos.value.y}px, 0)` } : { visibility: 'hidden' as const }))
</script>

<template>
  <div
    v-show="visible"
    ref="card"
    class="mp"
    :class="[take?.kind, { dragging }]"
    :style="style"
    role="region"
    :aria-label="t('player.region')"
    data-testid="mini-player"
    @pointerdown="onDown"
  >
    <div v-show="isVideo" class="screen" @click="onScreenClick">
      <video
        ref="media"
        :src="player.src ?? undefined"
        playsinline
        preload="metadata"
        @loadedmetadata="onMeta"
        @play="player.playing = true"
        @pause="player.playing = false"
        @ended="player.playing = false"
        @timeupdate="onTime"
      />
      <span v-if="!player.playing && player.status === 'ready'" class="big-play" aria-hidden="true"><UiGlyph name="play" :size="26" /></span>
    </div>

    <div v-if="take" class="body">
      <div class="top">
        <small class="meta">{{ meta }}</small>
        <button type="button" class="grip" :aria-label="t('player.move')" @keydown="onGripKey"><i /></button>
        <span class="acts">
          <NuxtLink :to="`/app/recordings/${take.id}`" class="ic" :aria-label="t('player.open')" :title="t('player.open')">
            <UiGlyph name="expand" :size="16" />
          </NuxtLink>
          <button type="button" class="ic" :aria-label="t('player.close')" :title="t('player.close')" data-testid="mini-close" @click="player.close()">
            <UiGlyph name="close" :size="16" />
          </button>
        </span>
      </div>

      <div class="row">
        <b class="title">{{ take.scriptTitle }}</b>
        <div class="ctrls" dir="ltr">
          <button type="button" class="ic skip" :aria-label="t('player.back10')" :title="t('player.back10')" :disabled="player.status !== 'ready'" @click="player.skip(-10)">
            <UiGlyph name="rewind" :size="18" />
          </button>
          <button
            type="button"
            class="play"
            :aria-label="player.playing ? t('recordings.pause') : t('recordings.play')"
            :disabled="player.status !== 'ready'"
            data-testid="mini-toggle"
            @click="player.toggle()"
          >
            <span v-if="player.status === 'loading'" class="spin" aria-hidden="true" />
            <UiGlyph v-else :name="player.playing ? 'pause' : 'play'" :size="22" />
          </button>
          <button type="button" class="ic skip fwd" :aria-label="t('player.fwd10')" :title="t('player.fwd10')" :disabled="player.status !== 'ready'" @click="player.skip(10)">
            <UiGlyph name="rewind" :size="18" />
          </button>
        </div>
      </div>

      <p v-if="player.status === 'error'" class="err" role="alert">{{ t('player.failed') }}</p>
      <div v-else class="prog" dir="ltr">
        <span class="time">{{ fmt(player.current) }}</span>
        <input
          class="seek"
          type="range"
          min="0"
          :max="player.duration"
          step="0.1"
          :value="player.current"
          :style="{ '--p': `${pct * 100}%` }"
          :disabled="!player.seekable"
          :aria-label="t('recordings.position')"
          :aria-valuetext="`${fmt(player.current)} / ${fmt(player.duration)}`"
          @input="player.seek(Number(($event.target as HTMLInputElement).value))"
        >
        <span class="time">{{ fmt(player.duration) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mp {
  position: fixed;
  inset-block-start: 0;
  left: 0;
  z-index: 35;
  display: grid;
  inline-size: min(400px, calc(100vw - 24px));
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--tilw-stage-secondary) 45%, transparent);
  border-radius: var(--tilw-radius-card);
  background: var(--tilw-stage-background);
  color: var(--tilw-stage-text);
  box-shadow: 0 20px 50px rgba(10, 18, 22, 0.35);
  touch-action: none;
  user-select: none;
  cursor: grab;
  transition: box-shadow 0.15s, scale 0.15s;
}
.mp.video {
  inline-size: min(420px, calc(100vw - 24px));
}
.mp.dragging {
  cursor: grabbing;
  scale: 1.02;
  box-shadow: 0 28px 60px rgba(10, 18, 22, 0.45);
}

.screen {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 16 / 9;
  background: #0f1a20;
  cursor: pointer;
}
.mp.dragging .screen {
  cursor: grabbing;
}
video {
  inline-size: 100%;
  block-size: 100%;
  object-fit: contain;
  pointer-events: none;
}
.big-play {
  position: absolute;
  display: grid;
  place-items: center;
  inline-size: 56px;
  block-size: 56px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--tilw-stage-background) 75%, transparent);
  color: var(--tilw-stage-cue);
}

.body {
  display: grid;
  gap: 6px;
  padding: 8px 14px 12px 18px;
}
.top {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-block-size: 30px;
}
.meta {
  flex: 1;
  min-inline-size: 0;
  overflow: hidden;
  color: var(--tilw-stage-secondary);
  font: var(--tilw-type-meta);
  text-overflow: ellipsis;
  white-space: pre;
}
.grip {
  position: absolute;
  inset-block-start: -4px;
  inset-inline-start: 50%;
  translate: -50% 0;
  display: grid;
  place-items: center;
  inline-size: 56px;
  block-size: 18px;
  padding: 0;
  border: 0;
  border-radius: var(--tilw-radius-pill);
  background: none;
  cursor: grab;
}
:dir(rtl) .grip {
  translate: 50% 0;
}
.grip i {
  inline-size: 36px;
  block-size: 4px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--tilw-stage-secondary) 55%, transparent);
}
.acts {
  display: flex;
  gap: 2px;
}
.ic {
  display: grid;
  place-items: center;
  inline-size: 30px;
  block-size: 30px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--tilw-stage-secondary);
  cursor: pointer;
}
.ic:hover:not(:disabled) {
  background: color-mix(in srgb, var(--tilw-stage-text) 12%, transparent);
  color: var(--tilw-stage-text);
}
.ic:disabled {
  opacity: 0.4;
  cursor: default;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.title {
  flex: 1;
  min-inline-size: 0;
  overflow: hidden;
  text-align: left;
  unicode-bidi: plaintext;
  font: 500 22px/1.4 var(--tilw-font-ar);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ctrls {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
}
.skip.fwd :deep(.ui-glyph) {
  transform: scaleX(-1);
}
.play {
  display: grid;
  place-items: center;
  inline-size: 52px;
  block-size: 52px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--tilw-stage-cue);
  color: var(--tilw-stage-background);
  cursor: pointer;
  transition: transform 0.12s;
}
.play:hover:not(:disabled) {
  transform: scale(1.05);
}
.play:disabled {
  opacity: 0.6;
  cursor: default;
}
.spin {
  inline-size: 20px;
  block-size: 20px;
  border: 2.5px solid currentColor;
  border-inline-end-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    rotate: 1turn;
  }
}

.prog {
  display: flex;
  align-items: center;
  gap: 10px;
}
.time {
  flex: 0 0 auto;
  min-inline-size: 36px;
  color: var(--tilw-stage-secondary);
  font: 500 12px/1 var(--tilw-font-lat);
  font-variant-numeric: tabular-nums;
}
.time:last-child {
  text-align: end;
}
.seek {
  flex: 1;
  min-inline-size: 40px;
  block-size: 18px;
  margin: 0;
  background: transparent;
  cursor: pointer;
  appearance: none;
}
.seek::-webkit-slider-runnable-track {
  block-size: 4px;
  border-radius: 2px;
  background: linear-gradient(to right, var(--tilw-stage-cue) var(--p, 0%), color-mix(in srgb, var(--tilw-stage-secondary) 30%, transparent) var(--p, 0%));
}
.seek::-moz-range-track {
  block-size: 4px;
  border-radius: 2px;
  background: linear-gradient(to right, var(--tilw-stage-cue) var(--p, 0%), color-mix(in srgb, var(--tilw-stage-secondary) 30%, transparent) var(--p, 0%));
}
.seek::-webkit-slider-thumb {
  inline-size: 14px;
  block-size: 14px;
  margin-block-start: -5px;
  border: 0;
  border-radius: 50%;
  background: var(--tilw-stage-cue);
  appearance: none;
}
.seek::-moz-range-thumb {
  inline-size: 14px;
  block-size: 14px;
  border: 0;
  border-radius: 50%;
  background: var(--tilw-stage-cue);
}
.seek:disabled {
  opacity: 0.45;
  cursor: default;
}
.err {
  margin: 0;
  color: var(--tilw-stage-cue);
  font: var(--tilw-type-meta);
}
.ic:focus-visible,
.play:focus-visible,
.grip:focus-visible,
.seek:focus-visible {
  outline: 2px solid var(--tilw-stage-cue);
  outline-offset: 2px;
}

@media (max-width: 760px) {
  .body {
    padding: 6px 10px 10px 14px;
  }
  .title {
    font-size: 18px;
  }
  .play {
    inline-size: 46px;
    block-size: 46px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .mp,
  .play {
    transition: none;
  }
}
:dir(rtl) .title {
  text-align: right;
}
</style>
