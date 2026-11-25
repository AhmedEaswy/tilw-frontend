<script setup lang="ts">
/**
 * Take review (US7, T081–T083): 6:46 video / 6:58 audio, phone 6:47 / 6:59. Plays the original from this
 * browser, shows length and container, lists the script's other takes, downloads the original file and
 * confirms (6:48 / 6:60 / 6:76). Star as best take and delete (G8) have no frames yet and use the same
 * side panel with a confirm dialog for delete.
 * Release 2 (R2-7 `264:676`, R2-8 `264:732`): Storage status chip, "نسخ إلى Google Drive", a take that is only in
 * Drive plays and downloads from Drive, and deleting a take that is in both places asks where to delete it.
 */
import { takePlace } from '~/utils/storage'
import type { TakeMeta } from '~/services/takes'

definePageMeta({ layout: 'reader' })
const { t, locale } = useI18n()
const route = useRoute()
const takes = useTakesStore()
const num = useTakeNumber()
const { show } = useToast()

const id = computed(() => String(route.params.takeId))
const take = computed<TakeMeta | null>(() => takes.find(id.value))
const siblings = computed(() => (take.value && !take.value.driveOnly ? takes.forScript(take.value.scriptId) : []))
const storage = useStorageStore()
const uploads = useUploadsStore()
const place = computed(() => (take.value ? takePlace(take.value, uploads.entries[take.value.id]).place : 'device'))
const canBackUp = computed(() => place.value === 'device' && storage.linked && storage.syncMode !== 'off')
const status = ref<'loading' | 'ready' | 'missing' | 'error'>('loading')
useHead({ title: () => `${take.value?.scriptTitle ?? t('nav.recordings')} · tilwprompter` })

const src = ref<string | null>(null)
function release() {
  if (src.value) URL.revokeObjectURL(src.value)
  src.value = null
}

async function open() {
  release()
  downloaded.value = false
  try {
    if (!takes.loaded) await takes.load()
    if (!takes.remoteLoaded) await takes.loadRemote().catch(() => {})
    if (!take.value) {
      status.value = 'missing'
      return
    }
    // A Drive-only take streams from Drive (research §8); a device take reads from this browser.
    const blob = await takes.blobFor(id.value)
    if (!blob) {
      status.value = 'missing'
      return
    }
    src.value = URL.createObjectURL(blob)
    status.value = 'ready'
  } catch {
    status.value = 'error'
  }
}
onMounted(open)
watch(id, open)
onBeforeUnmount(release)

// ---------- download (6:48 / 6:76) ----------
const downloaded = ref(false)
const busy = ref(false)
async function download() {
  if (!take.value || busy.value) return
  busy.value = true
  try {
    const ok = await downloadTake(take.value, t('studio.takeWord'))
    if (!ok) {
      status.value = 'missing'
      return
    }
    downloaded.value = true
  } finally {
    busy.value = false
  }
}

// ---------- feature 005: captions (US5) ----------
const captionsOpen = ref(false)
const captionTitle = computed(() => (take.value ? [take.value.scriptTitle, t('recordings.take', { n: num(take.value.number) })].join(' · ') : ''))

// ---------- star / delete (G8) ----------
async function toggleStar() {
  if (!take.value) return
  const on = !take.value.starred
  try {
    await takes.setStarred(take.value.id, on)
    show(on ? t('recordings.starred') : t('recordings.unstarred'))
  } catch {
    show(t('recordings.actionFailed'), 'error')
  }
}
const confirmDelete = ref(false)
const deleting = ref(false)
const player = ref<{ pause: () => void }>()
async function remove(everywhere = true) {
  if (!take.value) return
  deleting.value = true
  const gone = take.value
  try {
    player.value?.pause()
    release()
    await takes.removeTake(gone.id, everywhere)
    confirmDelete.value = false
    show(gone.driveOnly ? t('uploads.deletedDrive') : t('recordings.deleted', { n: num(gone.number) }))
    // Deleted from this device only: it is still in Drive, so show it there.
    const stays = !everywhere && gone.remote?.id ? takes.find(`r_${gone.remote.id}`) : null
    if (stays) return void navigateTo(`/app/recordings/${stays.id}`, { replace: true })
    const next = takes.forScript(gone.scriptId)[0]
    await navigateTo(next ? `/app/recordings/${next.id}` : '/app/recordings', { replace: true })
  } catch {
    show(t('recordings.actionFailed'), 'error')
  } finally {
    deleting.value = false
  }
}

const container = computed(() => (take.value ? containerLabel(take.value.mimeType) : ''))
const kindLabel = computed(() => (take.value?.kind === 'video' ? t('recordings.video') : t('recordings.audio')))
const subtitle = computed(() => {
  if (!take.value) return ''
  if (take.value.driveOnly) return t('uploads.place.driveOnly')
  return [t('recordings.take', { n: num(take.value.number) }), take.value.label].filter(Boolean).join('  ·  ')
})
const endedNote = computed(() => {
  const e = take.value?.endedBy
  if (e === 'limit') {
    // Release 2: the cap is the plan's, so say the length the take actually stopped at.
    const n = Math.max(1, Math.round((take.value?.durationMs ?? 0) / 60_000))
    return t('recordings.ended.limitN', { time: `${n} ${unitFor(n, 'minute', locale.value)}` })
  }
  return e ? t(`recordings.ended.${e}`) : ''
})
</script>

<template>
  <div class="review">
    <header class="mast">
      <NuxtLink to="/app/scripts" class="brand" :aria-label="t('nav.scripts')"><BrandSignature :width="143" /></NuxtLink>
      <p class="mast-title">{{ t('recordings.library') }}</p>
      <NuxtLink to="/app/recordings" class="round" :aria-label="t('recordings.all')"><UiGlyph name="back" :size="20" /></NuxtLink>
    </header>

    <main class="wrap">
      <!-- Loading: the review's own layout — title row, then the details column beside the player. -->
      <SkeletonRegion v-if="status === 'loading'" data-testid="take-skeleton">
        <div class="head" aria-hidden="true">
          <div class="head-skel">
            <UiSkeleton h="44px" w="min(360px, 70vw)" r="8px" />
            <UiSkeleton h="15px" w="120px" r="4px" />
          </div>
          <div class="head-links links-skel"><UiSkeleton h="16px" w="96px" r="4px" /><UiSkeleton h="16px" w="110px" r="4px" /></div>
        </div>
        <div class="grid" aria-hidden="true">
          <div class="side">
            <UiSkeleton class="h2-skel" h="30px" w="58%" />
            <div class="stats">
              <div><UiSkeleton h="14px" w="60%" r="4px" /><UiSkeleton h="22px" w="44%" r="4px" /></div>
              <div><UiSkeleton h="14px" w="52%" r="4px" /><UiSkeleton h="22px" w="70%" r="4px" /></div>
            </div>
            <UiSkeleton h="18px" w="46%" r="4px" />
            <UiSkeleton h="22px" w="54%" r="4px" />
            <span class="lede-skel"><UiSkeleton h="16px" w="92%" r="4px" /><UiSkeleton h="16px" w="64%" r="4px" /></span>
            <UiSkeleton v-for="i in 3" :key="i" h="48px" r="12px" />
          </div>
          <div class="main">
            <UiSkeleton class="player" h="" r="14px" />
            <UiSkeleton h="16px" w="90px" r="4px" />
            <div class="take-list"><UiSkeleton v-for="i in 3" :key="i" h="51px" r="8px" /></div>
          </div>
        </div>
      </SkeletonRegion>

      <UiEmptyState v-else-if="status !== 'ready' || !take" icon="video" :title="status === 'error' ? t('recordings.loadFailed') : t('recordings.missingTitle')" :text="status === 'error' ? '' : t('recordings.missingText')">
        <UiButton to="/app/recordings">{{ t('recordings.all') }}</UiButton>
      </UiEmptyState>

      <template v-else>
        <div class="head">
          <div>
            <h1 dir="auto">{{ take.scriptTitle }}</h1>
            <p class="sub">{{ subtitle }}<span v-if="take.starred" class="star">{{ t('recordings.best') }}</span></p>
          </div>
          <div class="head-links">
            <NuxtLink v-if="take.scriptId !== 'none'" :to="`/app/scripts/${take.scriptId}`" class="link" data-testid="take-open-script">{{ t('recordings.openScript') }}</NuxtLink>
            <NuxtLink to="/app/recordings" class="link">{{ t('recordings.all') }}</NuxtLink>
          </div>
        </div>

        <div class="grid">
          <section class="side" :aria-label="t('recordings.reviewTake')">
            <template v-if="!downloaded">
              <h2>{{ t('recordings.reviewTake') }}</h2>
              <dl class="stats">
                <div><dt>{{ t('recordings.duration') }}</dt><dd class="lat">{{ formatDuration(take.durationMs) }}</dd></div>
                <div><dt>{{ t('recordings.format') }}</dt><dd>{{ container }} · {{ kindLabel }}</dd></div>
              </dl>
              <TakeStorageStatus :take="take" actions detailed />
              <h3>{{ take.driveOnly ? t('uploads.driveOnlyTitle') : place === 'drive' ? t('uploads.bothTitle') : t('recordings.savedHere') }}</h3>
              <p class="lede">{{ take.driveOnly ? t('uploads.driveOnlyLede') : endedNote || (place === 'drive' ? t('uploads.bothLede') : t('recordings.keepCopy')) }}</p>
              <UiButton block icon="download" :loading="busy" @click="download">{{ t('recordings.downloadOriginal') }}</UiButton>
              <UiButton v-if="canBackUp" block tone="secondary" icon="up" @click="uploads.enqueue(take.id)">{{ t('uploads.copyLong') }}</UiButton>
              <UiButton v-if="take.scriptId !== 'none'" block tone="secondary" :to="`/app/scripts/${take.scriptId}/record`">{{ t('recordings.recordAnother') }}</UiButton>
              <!-- Feature 005 (US5, A5): captions built in this browser from the provider's word timings. -->
              <UiButton block tone="secondary" icon="file" data-testid="take-captions" @click="captionsOpen = true">{{ t('ai.captions.action') }}</UiButton>
            </template>
            <!-- 6:48 / 6:76 after the download starts -->
            <template v-else>
              <p class="kicker">{{ t('nav.recordings') }}</p>
              <h2 role="status">{{ t('recordings.sentTitle') }}</h2>
              <p class="lede">{{ t('recordings.sentLede') }}</p>
              <UiButton block to="/app/recordings">{{ t('recordings.all') }}</UiButton>
              <UiButton block tone="secondary" @click="downloaded = false">{{ t('library.back') }}</UiButton>
            </template>

            <div class="manage">
              <button type="button" class="link" :aria-pressed="take.starred" @click="toggleStar">
                {{ take.starred ? t('recordings.unstar') : t('recordings.star') }}
              </button>
              <button type="button" class="link danger" @click="confirmDelete = true">{{ t('recordings.delete') }}</button>
            </div>
          </section>

          <div class="main">
            <TakePlayer ref="player" class="player" :take="take" :src="src" />
            <div v-if="siblings.length > 1" class="takes">
              <p>{{ t('recordings.takes') }}</p>
              <div class="take-list">
                <NuxtLink
                  v-for="s in siblings"
                  :key="s.id"
                  :to="`/app/recordings/${s.id}`"
                  :aria-current="s.id === take.id ? 'page' : undefined"
                  replace
                >
                  <b>{{ t('recordings.take', { n: num(s.number) }) }}<span v-if="s.starred" class="star sm">{{ t('recordings.best') }}</span></b>
                  <small dir="ltr">{{ formatDuration(s.durationMs) }}</small>
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>

        <footer v-if="take.scriptId !== 'none'" class="foot">
          <NuxtLink :to="`/app/scripts/${take.scriptId}`" class="link">{{ t('studio.backToScript') }}</NuxtLink>
        </footer>
      </template>
    </main>

    <TakeDeleteDialog v-if="take" v-model:open="confirmDelete" :take="take" :busy="deleting" @confirm="remove" />
    <CaptionsDialog v-if="take && captionsOpen" v-model:open="captionsOpen" :take="take" :title="captionTitle" />
  </div>
</template>

<style scoped>
.head-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 20px;
}
.review {
  min-block-size: 100dvh;
  background: var(--tilw-surface-paper);
  color: var(--tilw-text-ink);
}
.mast {
  display: flex;
  align-items: center;
  gap: 32px;
  block-size: 80px;
  padding-inline: max(46px, env(safe-area-inset-left, 0px)) max(45px, env(safe-area-inset-right, 0px));
  border-block-end: 1px solid var(--tilw-border-subtle);
}
.brand {
  display: flex;
}
.mast-title {
  margin: 0;
  font: 500 17px/1.36 var(--tilw-font-ar);
}
.round {
  display: grid;
  place-items: center;
  inline-size: 46px;
  block-size: 46px;
  margin-inline-start: auto;
  border-radius: 23px;
  background: var(--tilw-surface-quiet);
  color: var(--tilw-text-ink);
}
.wrap {
  inline-size: min(1172px, calc(100% - 64px));
  margin-inline: auto;
  padding-block: 39px 40px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-block-end: 16px;
  border-block-end: 1px solid var(--tilw-border-subtle);
}
.head h1 {
  margin: 0;
  font: 700 39px/1.36 var(--tilw-font-ar);
}
.sub {
  margin: 14px 0 0;
  color: var(--tilw-text-muted);
  font: 500 15px/1.36 var(--tilw-font-ar);
  white-space: pre;
}
.star {
  display: inline-block;
  margin-inline-start: 10px;
  padding: 0 8px;
  border-radius: 9px;
  background: var(--tilw-stage-cue);
  color: var(--tilw-stage-background);
  font: 500 12px/18px var(--tilw-font-ar);
}
.star.sm {
  margin-inline-start: 6px;
}
.link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--tilw-action-primary);
  font: 500 16px/1.36 var(--tilw-font-ar);
  text-decoration: none;
  cursor: pointer;
}
.link:hover {
  text-decoration: underline;
}
.link.danger {
  color: var(--tilw-status-error);
}
.link:focus-visible,
.round:focus-visible,
.take-list a:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
.grid {
  display: grid;
  grid-template-columns: minmax(0, 423px) minmax(0, 718px);
  justify-content: space-between;
  gap: 31px;
  padding-block: 30px;
}
.side {
  display: grid;
  align-content: start;
  gap: 15px;
}
.side h2 {
  margin: 0 0 12px;
  font: 700 27px/1.36 var(--tilw-font-ar);
}
.kicker {
  margin: 0;
  color: var(--tilw-action-primary);
  font: 500 16px/1.36 var(--tilw-font-ar);
}
.stats {
  display: grid;
  grid-template-columns: 201fr 209fr;
  gap: 12px;
  margin: 0 0 24px;
}
.stats div {
  display: grid;
  gap: 4px;
  padding: 8px 14px 12px;
  border-radius: 8px;
  background: var(--tilw-surface-quiet);
}
.stats dt {
  color: var(--tilw-text-muted);
  font: 500 15px/1.36 var(--tilw-font-ar);
}
.stats dd {
  margin: 0;
  font: 500 21px/1.36 var(--tilw-font-ar);
}
.stats dd.lat {
  font-family: var(--tilw-font-lat);
}
.side h3 {
  margin: 0;
  font: 500 21px/1.36 var(--tilw-font-ar);
}
.lede {
  margin: 0 0 22px;
  color: var(--tilw-text-muted);
  font: 400 18px/1.36 var(--tilw-font-ar);
}
.manage {
  display: flex;
  gap: 24px;
  margin-block-start: 18px;
  padding-block-start: 16px;
  border-block-start: 1px solid var(--tilw-border-subtle);
}
.main {
  display: grid;
  gap: 8px;
  align-content: start;
}
.player {
  block-size: 420px;
}
.takes p {
  margin: 0 0 6px;
  font: 500 16px/24px var(--tilw-font-ar);
}
.take-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}
.take-list a {
  display: grid;
  min-block-size: 51px;
  padding: 4px 14px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: 8px;
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
  text-decoration: none;
}
.take-list a[aria-current='page'] {
  border-color: var(--tilw-action-primary);
  background: var(--tilw-surface-selected);
}
.take-list b {
  font: 500 15px/24px var(--tilw-font-ar);
}
.take-list small {
  justify-self: end;
  color: var(--tilw-text-muted);
  font: 500 12px/17px var(--tilw-font-lat);
}
:dir(rtl) .take-list small {
  justify-self: start;
}
.foot {
  padding-block-start: 6px;
  border-block-start: 1px solid var(--tilw-border-subtle);
}

/* Loading shapes */
.head-skel {
  display: grid;
  gap: 14px;
  padding-block: 5px 2px;
}
.h2-skel {
  margin-block-end: 12px;
}
.stats div :deep(.ui-skel) {
  --skel-base: var(--tilw-surface-white);
}
.lede-skel {
  display: grid;
  gap: 8px;
  margin-block-end: 22px;
}

@media (max-width: 1000px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .main {
    order: -1;
  }
}
@media (max-width: 760px) {
  .mast {
    gap: 12px;
    block-size: 64px;
    padding-inline: 16px;
  }
  .brand {
    display: none;
  }
  .wrap {
    inline-size: calc(100% - 32px);
    padding-block: 20px 32px;
  }
  .head h1 {
    font-size: 28px;
  }
  .head .link,
  .links-skel {
    display: none;
  }
  .player {
    block-size: 300px;
  }
}
</style>
