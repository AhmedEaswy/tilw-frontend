<script setup lang="ts">
/**
 * The recordings list (US7, T080): 6:74 desktop, 6:103 phone, first visit 6:77. Used by the Recordings page (every
 * script) and by a script's Recordings tab (`scriptId`: only that script's takes, with the script as the title).
 * Desktop groups takes by script — a card for the newest take with older takes listed under it.
 * Phone shows the newest take as a feature card, then every take in one list (6:103).
 * A banner warns when browser storage is running low (G8).
 * Release 2 (R2-7 `262:1018`): each take shows where it is (Storage status), device takes offer "نسخ إلى Drive"
 * when sync is on, takes backed up from another device show as "In Drive only", and a line names the storage mode.
 */
import type { TakeMeta } from '~/services/takes'

const props = defineProps<{ scriptId?: string; title?: string; titlePending?: boolean }>()
const { t } = useI18n()
const takes = useTakesStore()
const all = computed(() => (props.scriptId ? takes.all.filter(x => x.scriptId === props.scriptId) : takes.all))
const groups = computed(() => (props.scriptId ? takes.groups.filter(g => g[0]?.scriptId === props.scriptId) : takes.groups))
const num = useTakeNumber()
const phone = useMediaQuery('(max-width: 760px)')

const storage = useStorageStore()
const failed = ref(false)
onMounted(async () => {
  await takes.load().catch(() => (failed.value = true))
  // SC-005: Drive-only takes from other devices appear as soon as the list opens.
  void takes.loadRemote().catch(() => {})
})

const kindLabel = (k: TakeMeta['kind']) => (k === 'video' ? t('recordings.video') : t('recordings.audio'))
function meta(take: TakeMeta, withNumber = true) {
  return [withNumber && !take.driveOnly ? t('recordings.take', { n: num(take.number) }) : null, kindLabel(take.kind), formatDuration(take.durationMs)]
    .filter(Boolean)
    .join('  ·  ')
}
const latest = computed(() => all.value[0] ?? null)
const modeLine = computed(() => {
  if (!storage.status) return null
  if (!storage.linked) return t('uploads.modeLine.none')
  return t(`uploads.modeLine.${storage.syncMode}`)
})
</script>

<template>
  <div class="rec-list">
    <header class="head">
      <h1 v-if="titlePending && !title" class="h1-skel" aria-hidden="true"><UiSkeleton h="40px" w="min(320px, 70%)" r="8px" /></h1>
      <h1 v-else dir="auto">{{ title ?? (phone ? t('nav.recordings') : t('recordings.title')) }}</h1>
      <p>{{ phone ? t('recordings.onDevice') : t('recordings.lede') }}</p>
      <p v-if="modeLine" class="mode">{{ modeLine }} <NuxtLink to="/app/settings/storage">{{ storage.linked ? t('uploads.change') : t('storage.link') }}</NuxtLink></p>
      <p v-else-if="storage.loading" class="mode" aria-hidden="true"><UiSkeleton h="15px" w="min(300px, 80%)" r="4px" /></p>
    </header>

    <UiBanner v-if="takes.lowStorage" tone="warning" class="banner">{{ t('recordings.lowStorage') }}</UiBanner>
    <UiBanner v-if="failed" tone="error" class="banner">{{ t('recordings.loadFailed') }}</UiBanner>

    <!-- Loading, phone (6:103): the feature card for the newest take, then the list of the others. -->
    <SkeletonRegion v-if="!takes.loaded && !failed && phone" data-testid="recordings-skeleton">
      <div class="feature" aria-hidden="true">
        <UiSkeleton class="f-cover" tone="stage" h="214px" r="0" />
        <span class="f-txt">
          <UiSkeleton tone="stage" h="28px" w="80%" />
          <UiSkeleton tone="stage" h="14px" w="64%" r="4px" />
          <UiSkeleton class="f-btn-skel" tone="stage" h="48px" r="12px" />
        </span>
      </div>
      <div class="all" aria-hidden="true"><UiSkeleton h="30px" w="40%" /></div>
      <SkeletonRows :count="3" height="76px" gap="14px" lead="square" lead-size="46px" class="rows-skel" />
    </SkeletonRegion>

    <!-- Loading, desktop (6:74): one group per script — the newest take's card, its status line, an older take. -->
    <SkeletonRegion v-else-if="!takes.loaded && !failed" class="grid" data-testid="recordings-skeleton">
      <section v-for="i in (scriptId ? 1 : 2)" :key="i" class="group" aria-hidden="true">
        <SkeletonCard media="212px" padding="21px 21px 22px" radius="13px" title="35px" :title-w="i === 1 ? '62%' : '48%'" :lines="0">
          <UiSkeleton h="20px" w="46%" r="4px" />
          <UiSkeleton h="20px" w="30%" r="4px" />
        </SkeletonCard>
        <UiSkeleton class="c-status" h="18px" w="42%" r="4px" />
        <SkeletonRows class="older-skel" :count="1" height="76px" />
      </section>
    </SkeletonRegion>

    <!-- 6:77 first visit -->
    <section v-else-if="takes.loaded && !all.length" class="first">
      <div v-if="scriptId" class="first-txt">
        <h2>{{ t('recordings.scriptEmptyTitle') }}</h2>
        <p>{{ t('recordings.scriptEmptyLede') }}</p>
        <UiButton tone="cue" :to="`/app/scripts/${scriptId}/record`">{{ t('recordings.recordThis') }}</UiButton>
      </div>
      <div v-else class="first-txt">
        <h2>{{ t('recordings.firstTitle') }}</h2>
        <p>{{ t('recordings.firstLede') }}</p>
        <UiButton tone="cue" to="/app/scripts">{{ t('recordings.pickScript') }}</UiButton>
      </div>
      <div class="first-art" aria-hidden="true">
        <UiGlyph name="video" :size="72" />
        <UiGlyph class="mic" name="mic" :size="40" />
      </div>
    </section>

    <!-- 6:103 phone -->
    <template v-else-if="phone && latest">
      <NuxtLink :to="`/app/recordings/${latest.id}`" class="feature">
        <TakeCover class="f-cover" :take="latest" :bars="14" />
        <span class="f-txt">
          <b dir="auto">{{ latest.scriptTitle }}<span v-if="latest.starred" class="star">{{ t('recordings.best') }}</span></b>
          <small>{{ meta(latest) }}</small>
          <span class="f-btn">{{ t('recordings.review') }}</span>
        </span>
      </NuxtLink>
      <TakeStorageStatus class="f-status" :take="latest" actions />
      <NuxtLink v-if="!scriptId && latest.scriptId !== 'none'" :to="`/app/scripts/${latest.scriptId}`" class="open-script">{{ t('recordings.openScript') }}</NuxtLink>
      <h2 v-if="all.length > 1" class="all">{{ t('recordings.all') }}</h2>
      <ul v-if="all.length > 1" class="rows">
        <li v-for="take in all.slice(1)" :key="take.id">
          <NuxtLink :to="`/app/recordings/${take.id}`" class="row">
            <span class="kind" :class="take.kind"><UiGlyph :name="take.kind === 'video' ? 'video' : 'mic'" :size="20" /></span>
            <span class="r-txt">
              <b dir="auto">{{ take.scriptTitle }}<span v-if="take.starred" class="star">{{ t('recordings.best') }}</span></b>
              <small>{{ meta(take) }}</small>
            </span>
            <UiGlyph class="go" name="play" :size="16" />
          </NuxtLink>
          <TakeStorageStatus class="r-status" :take="take" actions />
        </li>
      </ul>
    </template>

    <!-- 6:74 desktop -->
    <div v-else class="grid">
      <section v-for="group in groups" :key="group[0]!.scriptId" class="group">
        <NuxtLink :to="`/app/recordings/${group[0]!.id}`" class="card">
          <TakeCover class="cover" :take="group[0]!" />
          <span class="c-txt">
            <b dir="auto">{{ group[0]!.scriptTitle }}</b>
            <small>{{ meta(group[0]!) }}<span v-if="group[0]!.starred" class="star">{{ t('recordings.best') }}</span></small>
            <span class="c-link">{{ group[0]!.kind === 'video' ? t('recordings.reviewTake') : t('recordings.reviewRecording') }}</span>
          </span>
        </NuxtLink>
        <TakeStorageStatus class="c-status" :take="group[0]!" actions />
        <NuxtLink v-if="!scriptId && group[0]!.scriptId !== 'none'" :to="`/app/scripts/${group[0]!.scriptId}`" class="open-script" data-testid="group-open-script">{{ t('recordings.openScript') }}</NuxtLink>
        <template v-for="take in group.slice(1)" :key="take.id">
          <NuxtLink :to="`/app/recordings/${take.id}`" class="older">
            <b>{{ take.driveOnly ? take.scriptTitle : t('recordings.take', { n: num(take.number) }) }}<template v-if="take.label">  ·  {{ take.label }}</template><span v-if="take.starred" class="star">{{ t('recordings.best') }}</span></b>
            <small>{{ kindLabel(take.kind) }}  ·  {{ formatDuration(take.durationMs) }}</small>
          </NuxtLink>
          <TakeStorageStatus class="o-status" :take="take" actions />
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.open-script {
  justify-self: start;
  align-self: start;
  color: var(--tilw-action-primary);
  font: 500 15px/1.36 var(--tilw-font-ar);
  text-decoration: none;
}
.open-script:hover {
  text-decoration: underline;
}
.open-script:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
.rec-list {
  padding-block: 37px 40px;
}
.head h1 {
  margin: 0;
  font: 700 41px/1.36 var(--tilw-font-ar);
}
.head p {
  margin: 12px 0 0;
  color: var(--tilw-text-muted);
  font: 400 18px/1.36 var(--tilw-font-ar);
  white-space: pre-line;
}
.mode {
  margin: 8px 0 0;
  color: var(--tilw-text-muted);
  font: 400 15px/1.5 var(--tilw-font-ar);
}
.mode a {
  color: var(--tilw-action-primary);
  font-weight: 500;
}
.c-status,
.o-status,
.f-status,
.r-status {
  margin-block-start: 10px;
  padding-inline: 4px;
}
.r-status {
  margin-block: 6px 4px;
}
.banner {
  margin-block-start: 24px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr));
  gap: 17px;
  margin-block-start: 59px;
  align-items: start;
}
.group {
  display: grid;
  gap: 21px;
}
.card {
  display: grid;
  overflow: hidden;
  border-radius: 13px;
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
  text-decoration: none;
}
.cover {
  block-size: 212px;
}
.c-txt {
  display: grid;
  gap: 14px;
  padding: 21px 21px 22px;
}
.c-txt b {
  font: 700 26px/1.36 var(--tilw-font-ar);
}
.c-txt small {
  color: var(--tilw-text-muted);
  font: 400 17px/1.36 var(--tilw-font-ar);
  white-space: pre;
}
.c-link {
  color: var(--tilw-action-primary);
  font: 500 17px/1.36 var(--tilw-font-ar);
}
.card:hover .c-link {
  text-decoration: underline;
}
.older {
  display: grid;
  gap: 2px;
  min-block-size: 76px;
  padding: 9px 18px 10px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: 10px;
  background: var(--tilw-surface-selected);
  color: var(--tilw-text-ink);
  text-decoration: none;
}
.older b {
  font: 500 18px/27px var(--tilw-font-ar);
  white-space: pre;
}
.older small {
  color: var(--tilw-text-muted);
  font: 500 14px/20px var(--tilw-font-ar);
  white-space: pre;
}
.older:hover {
  border-color: var(--tilw-border-strong);
}
.star {
  display: inline-block;
  margin-inline-start: 10px;
  padding: 0 8px;
  border-radius: 9px;
  background: var(--tilw-stage-cue);
  color: var(--tilw-stage-background);
  font: 500 12px/18px var(--tilw-font-ar);
  vertical-align: middle;
}
.card:focus-visible,
.older:focus-visible,
.row:focus-visible,
.feature:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 3px;
}

/* Loading shapes (same boxes as the cards and rows above) */
.h1-skel {
  display: flex;
  align-items: center;
  min-block-size: calc(41px * 1.36);
}
.older-skel :deep(.sk-row) {
  border: 1px solid var(--tilw-border-subtle);
  border-radius: 10px;
  background: var(--tilw-surface-selected);
}
.rows-skel :deep(.sk-row) {
  border-radius: 12px;
}
.f-btn-skel {
  margin-block-start: 24px;
}

/* 6:77 */
.first {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.8fr);
  align-items: center;
  gap: 32px;
  min-block-size: 384px;
  margin-block-start: 58px;
  padding: 44px;
  border-radius: 12px;
  background: var(--tilw-stage-background);
  color: var(--tilw-stage-text);
}
.first-txt {
  display: grid;
  justify-items: start;
  gap: 14px;
}
.first-txt h2 {
  margin: 0;
  font: 700 31px/1.36 var(--tilw-font-ar);
}
.first-txt p {
  margin: 0 0 40px;
  color: var(--tilw-stage-secondary);
  font: 400 18px/1.5 var(--tilw-font-ar);
}
.first-txt :deep(.ui-btn) {
  min-inline-size: 243px;
}
.first-art {
  position: relative;
  display: grid;
  place-items: center;
  color: var(--tilw-stage-secondary);
}
.first-art .mic {
  position: absolute;
  inset-block-start: 58%;
  inset-inline-start: calc(50% - 82px);
  color: var(--tilw-stage-cue);
}

/* 6:103 phone */
.feature {
  display: grid;
  grid-template-columns: 1fr 1fr;
  overflow: hidden;
  margin-block-start: 32px;
  border-radius: 16px;
  background: var(--tilw-stage-background);
  color: var(--tilw-stage-text);
  text-decoration: none;
}
.f-cover {
  grid-column: 2;
  grid-row: 1;
  min-block-size: 214px;
  border-radius: 0;
}
.f-txt {
  grid-column: 1;
  grid-row: 1;
  display: grid;
  align-content: start;
  gap: 10px;
  padding: 26px 18px 20px;
}
.f-txt b {
  font: 700 22px/1.36 var(--tilw-font-ar);
}
.f-txt small {
  color: var(--tilw-stage-secondary);
  font: 400 14px/1.36 var(--tilw-font-ar);
  white-space: pre;
}
.f-btn {
  display: grid;
  place-items: center;
  min-block-size: 48px;
  margin-block-start: 24px;
  border-radius: var(--tilw-radius-control);
  background: var(--tilw-stage-cue);
  color: var(--tilw-stage-background);
  font: var(--tilw-type-control);
}
.all {
  margin: 40px 0 18px;
  font: 700 22px/1.36 var(--tilw-font-ar);
}
.rows {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.row {
  display: flex;
  align-items: center;
  gap: 14px;
  min-block-size: 76px;
  padding-inline: 14px 18px;
  border-radius: 12px;
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
  text-decoration: none;
}
.kind {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  inline-size: 46px;
  block-size: 46px;
  border-radius: 9px;
  background: var(--tilw-surface-sage);
  color: var(--tilw-text-ink);
}
.kind.audio {
  background: var(--tilw-surface-selected);
  color: var(--tilw-action-primary);
}
.r-txt {
  display: grid;
  flex: 1;
  min-inline-size: 0;
}
.r-txt b {
  font: 500 18px/1.36 var(--tilw-font-ar);
}
.r-txt small {
  color: var(--tilw-text-muted);
  font: 400 14px/1.36 var(--tilw-font-ar);
  white-space: pre;
}
.go {
  color: var(--tilw-action-primary);
}
:dir(rtl) .go {
  transform: scaleX(-1);
}

@media (max-width: 760px) {
  .rec-list {
    padding-block: 24px 24px;
  }
  .head h1 {
    font-size: 34px;
  }
  .head p {
    margin-block-start: 4px;
    font-size: 15px;
  }
  .first {
    grid-template-columns: 1fr;
    padding: 28px 20px;
  }
  .first-art {
    display: none;
  }
}
</style>
