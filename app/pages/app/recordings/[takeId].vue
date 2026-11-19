<script setup lang="ts">
/**
 * Take review (US7, T081–T083): 6:46 video / 6:58 audio, phone 6:47 / 6:59. Plays the original from this
 * browser, shows length and container, lists the script's other takes, downloads the original file and
 * confirms (6:48 / 6:60 / 6:76). Star as best take and delete (G8) have no frames yet and use the same
 * side panel with a confirm dialog for delete.
 */
import type { TakeMeta } from '~/services/takes'

definePageMeta({ layout: 'reader' })
const { t } = useI18n()
const route = useRoute()
const takes = useTakesStore()
const num = useTakeNumber()
const { show } = useToast()

const id = computed(() => String(route.params.takeId))
const take = computed<TakeMeta | null>(() => takes.list.find(x => x.id === id.value) ?? null)
const siblings = computed(() => (take.value ? takes.forScript(take.value.scriptId) : []))
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
    if (!take.value) {
      status.value = 'missing'
      return
    }
    const full = await useTakesRepo().get(id.value)
    if (!full) {
      status.value = 'missing'
      return
    }
    src.value = URL.createObjectURL(full.blob)
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
async function remove() {
  if (!take.value) return
  deleting.value = true
  const gone = take.value
  try {
    player.value?.pause()
    release()
    await takes.remove(gone.id)
    confirmDelete.value = false
    show(t('recordings.deleted', { n: num(gone.number) }))
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
  return [t('recordings.take', { n: num(take.value.number) }), take.value.label].filter(Boolean).join('  ·  ')
})
const endedNote = computed(() => {
  const e = take.value?.endedBy
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
      <div v-if="status === 'loading'" class="state" aria-busy="true"><UiSkeleton h="420px" r="14px" /></div>

      <UiEmptyState v-else-if="status !== 'ready' || !take" icon="video" :title="status === 'error' ? t('recordings.loadFailed') : t('recordings.missingTitle')" :text="status === 'error' ? '' : t('recordings.missingText')">
        <UiButton to="/app/recordings">{{ t('recordings.all') }}</UiButton>
      </UiEmptyState>

      <template v-else>
        <div class="head">
          <div>
            <h1 dir="auto">{{ take.scriptTitle }}</h1>
            <p class="sub">{{ subtitle }}<span v-if="take.starred" class="star">{{ t('recordings.best') }}</span></p>
          </div>
          <NuxtLink to="/app/recordings" class="link">{{ t('recordings.all') }}</NuxtLink>
        </div>

        <div class="grid">
          <section class="side" :aria-label="t('recordings.reviewTake')">
            <template v-if="!downloaded">
              <h2>{{ t('recordings.reviewTake') }}</h2>
              <dl class="stats">
                <div><dt>{{ t('recordings.duration') }}</dt><dd class="lat">{{ formatDuration(take.durationMs) }}</dd></div>
                <div><dt>{{ t('recordings.format') }}</dt><dd>{{ container }} · {{ kindLabel }}</dd></div>
              </dl>
              <h3>{{ t('recordings.savedHere') }}</h3>
              <p class="lede">{{ endedNote || t('recordings.keepCopy') }}</p>
              <UiButton block icon="download" :loading="busy" @click="download">{{ t('recordings.downloadOriginal') }}</UiButton>
              <UiButton block tone="secondary" :to="`/app/scripts/${take.scriptId}/record`">{{ t('recordings.recordAnother') }}</UiButton>
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

        <footer class="foot">
          <NuxtLink :to="`/app/scripts/${take.scriptId}`" class="link">{{ t('studio.backToScript') }}</NuxtLink>
        </footer>
      </template>
    </main>

    <UiDialog v-model:open="confirmDelete" :title="t('recordings.deleteTitle')">
      <p>{{ t('recordings.deleteLede') }}</p>
      <template #actions>
        <UiButton tone="danger" :loading="deleting" @click="remove">{{ t('recordings.deleteConfirm') }}</UiButton>
        <UiButton tone="secondary" @click="confirmDelete = false">{{ t('library.back') }}</UiButton>
      </template>
    </UiDialog>
  </div>
</template>

<style scoped>
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
  .head .link {
    display: none;
  }
  .player {
    block-size: 300px;
  }
}
</style>
