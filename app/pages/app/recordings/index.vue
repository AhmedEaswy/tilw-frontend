<script setup lang="ts">
/**
 * Recordings kept in this browser (US7, T080): 6:74 desktop, 6:103 phone, first visit 6:77.
 * Desktop groups takes by script — a card for the newest take with older takes listed under it.
 * Phone shows the newest take as a feature card, then every take in one list (6:103).
 * A banner warns when browser storage is running low (G8).
 * Release 2 (R2-7 `262:1018`): each take shows where it is (Storage status), device takes offer "نسخ إلى Drive"
 * when sync is on, takes backed up from another device show as "In Drive only", and a line names the storage mode.
 */
import type { TakeMeta } from '~/services/takes'

definePageMeta({ layout: 'app' })
const { t } = useI18n()
useHead({ title: () => `${t('nav.recordings')} · tilwprompter` })
const takes = useTakesStore()
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
const latest = computed(() => takes.all[0] ?? null)

// "…" on each take opens its actions (play, view, sync / withdraw / unsync), like the script list.
const actionsTake = ref<TakeMeta | null>(null)
const actionsOpen = ref(false)
function openActions(take: TakeMeta) {
  actionsTake.value = take
  actionsOpen.value = true
}
// Follow the take as its Drive state changes while the sheet is open.
watch(() => takes.all, (all) => {
  if (actionsTake.value) actionsTake.value = all.find(x => x.id === actionsTake.value!.id) ?? null
})
const moreLabel = (take: TakeMeta) => t('library.actionsFor', { title: take.driveOnly ? take.scriptTitle : `${take.scriptTitle} · ${t('recordings.take', { n: num(take.number) })}` })
const modeLine = computed(() => {
  if (!storage.status) return null
  if (!storage.linked) return t('uploads.modeLine.none')
  return t(`uploads.modeLine.${storage.syncMode}`)
})
</script>

<template>
  <div class="rec-list">
    <header class="head">
      <h1>{{ phone ? t('nav.recordings') : t('recordings.title') }}</h1>
      <p>{{ phone ? t('recordings.onDevice') : t('recordings.lede') }}</p>
      <p v-if="modeLine" class="mode">{{ modeLine }} <NuxtLink to="/app/settings/storage">{{ storage.linked ? t('uploads.change') : t('storage.link') }}</NuxtLink></p>
    </header>

    <UiBanner v-if="takes.lowStorage" tone="warning" class="banner">{{ t('recordings.lowStorage') }}</UiBanner>
    <UiBanner v-if="failed" tone="error" class="banner">{{ t('recordings.loadFailed') }}</UiBanner>

    <div v-if="!takes.loaded && !failed" class="grid" aria-busy="true">
      <UiSkeleton h="368px" r="13px" />
      <UiSkeleton h="368px" r="13px" />
    </div>

    <!-- 6:77 first visit -->
    <section v-else-if="takes.loaded && !takes.all.length" class="first">
      <div class="first-txt">
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
      <div class="feature-wrap">
      <NuxtLink :to="`/app/recordings/${latest.id}`" class="feature">
        <TakeCover class="f-cover" :take="latest" :bars="14" />
        <span class="f-txt">
          <b dir="auto">{{ latest.scriptTitle }}<span v-if="latest.starred" class="star">{{ t('recordings.best') }}</span></b>
          <small>{{ meta(latest) }}</small>
          <span class="f-btn">{{ t('recordings.review') }}</span>
        </span>
      </NuxtLink>
      <button type="button" class="more on-stage" :aria-label="moreLabel(latest)" data-testid="take-more" @click="openActions(latest)"><UiGlyph name="more" :size="20" /></button>
      </div>
      <TakeStorageStatus class="f-status" :take="latest" actions />
      <h2 v-if="takes.all.length > 1" class="all">{{ t('recordings.all') }}</h2>
      <ul v-if="takes.all.length > 1" class="rows">
        <li v-for="take in takes.all.slice(1)" :key="take.id">
          <NuxtLink :to="`/app/recordings/${take.id}`" class="row">
            <span class="kind" :class="take.kind"><UiGlyph :name="take.kind === 'video' ? 'video' : 'mic'" :size="20" /></span>
            <span class="r-txt">
              <b dir="auto">{{ take.scriptTitle }}<span v-if="take.starred" class="star">{{ t('recordings.best') }}</span></b>
              <small>{{ meta(take) }}</small>
            </span>
          </NuxtLink>
          <button type="button" class="more on-row" :aria-label="moreLabel(take)" data-testid="take-more" @click="openActions(take)"><UiGlyph name="more" :size="20" /></button>
          <TakeStorageStatus class="r-status" :take="take" actions />
        </li>
      </ul>
    </template>

    <!-- 6:74 desktop -->
    <div v-else class="grid">
      <section v-for="group in takes.groups" :key="group[0]!.scriptId" class="group">
        <div class="card-wrap">
        <NuxtLink :to="`/app/recordings/${group[0]!.id}`" class="card">
          <TakeCover class="cover" :take="group[0]!" />
          <span class="c-txt">
            <b dir="auto">{{ group[0]!.scriptTitle }}</b>
            <small>{{ meta(group[0]!) }}<span v-if="group[0]!.starred" class="star">{{ t('recordings.best') }}</span></small>
          </span>
        </NuxtLink>
        <button type="button" class="more on-card" :aria-label="moreLabel(group[0]!)" data-testid="take-more" @click="openActions(group[0]!)"><UiGlyph name="more" :size="20" /></button>
        </div>
        <TakeStorageStatus class="c-status" :take="group[0]!" actions />
        <template v-for="take in group.slice(1)" :key="take.id">
          <div class="older-wrap">
          <NuxtLink :to="`/app/recordings/${take.id}`" class="older">
            <b>{{ take.driveOnly ? take.scriptTitle : t('recordings.take', { n: num(take.number) }) }}<template v-if="take.label">  ·  {{ take.label }}</template><span v-if="take.starred" class="star">{{ t('recordings.best') }}</span></b>
            <small>{{ kindLabel(take.kind) }}  ·  {{ formatDuration(take.durationMs) }}</small>
          </NuxtLink>
          <button type="button" class="more on-row" :aria-label="moreLabel(take)" data-testid="take-more" @click="openActions(take)"><UiGlyph name="more" :size="20" /></button>
          </div>
          <TakeStorageStatus class="o-status" :take="take" actions />
        </template>
      </section>
    </div>

    <TakeActionsDialog v-model:open="actionsOpen" :take="actionsTake" />
  </div>
</template>

<style scoped>
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
/* "…" actions (same button as the script rows), laid over each take's link. */
.card-wrap,
.older-wrap,
.feature-wrap,
.rows li {
  position: relative;
}
.card-wrap .c-txt,
.older-wrap .older,
.rows li .row {
  padding-inline-end: 64px;
}
.more {
  position: absolute;
  display: grid;
  place-items: center;
  inline-size: var(--tilw-hit);
  block-size: var(--tilw-hit);
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: none;
  color: var(--tilw-text-ink);
  cursor: pointer;
}
.more:hover {
  background: var(--tilw-surface-quiet);
}
.more:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
.more.on-card {
  inset-block-end: 16px;
  inset-inline-end: 12px;
}
.more.on-row {
  inset-block-start: 14px;
  inset-inline-end: 10px;
}
.older-wrap .more.on-row {
  inset-block-start: calc(50% - var(--tilw-hit) / 2);
}
.more.on-stage {
  inset-block-start: 10px;
  inset-inline-end: 10px;
  background: color-mix(in srgb, var(--tilw-stage-background) 70%, transparent);
  color: var(--tilw-stage-text);
}
.more.on-stage:hover {
  background: var(--tilw-stage-background);
}
.card:hover .c-txt b {
  color: var(--tilw-action-primary);
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
