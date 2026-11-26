<script setup lang="ts">
/**
 * Script library (6:18 desktop, 6:20 phone, 6:83 en; pinned 6:112, archived 6:111; empty 6:22).
 * T041–T046.
 */
import type { ScriptSummary } from '~/services/types'
import type { LibraryDialog } from '~/components/scripts/LibraryDialogs.vue'
import type { ScriptAction } from '~/components/scripts/ScriptRow.vue'
import type { ScriptFilter, ScriptSort } from '~/stores/scripts'
import type { UiMenuItem } from '~/components/ui/UiMenu.vue'

definePageMeta({ layout: 'app' })
const { t } = useI18n()
useHead({ title: () => `${t('nav.scripts')} · tilwprompter` })

const store = useScriptsStore()
const errorText = useErrorText()
const plan = usePlanStore()
// Recordings per script (this device and Drive), for the count on each row.
const takes = useTakesStore()
onMounted(() => {
  void store.load()
  if (!takes.loaded) void takes.load().catch(() => {})
  void takes.loadRemote().catch(() => {})
})

// Release 2 (R2-2): "14 من 20 نصاً نشطاً" next to New script when the plan caps active scripts.
const activeCap = computed(() => {
  const max = plan.limit('scripts.max_active')
  if (typeof max !== 'number') return null
  // The plan's usage counts every active script; the library only has the pages loaded so far.
  const used = plan.usage('scripts.max_active')
  return { n: typeof used === 'number' ? used : store.items.filter(s => !s.archivedAt).length, max }
})

const dialog = ref<LibraryDialog>(null)
// Feature 005 (US3, A4): a new script from an audio file.
const audioOpen = ref(false)
// The header's "New script" menu: the three ways to start one.
const newItems = computed<UiMenuItem[]>(() => [
  { key: 'create', label: t('library.create'), icon: 'edit' },
  { key: 'import', label: t('library.importFile'), icon: 'file' },
  // Only with speech to text on the plan.
  ...(plan.cloudSpeech ? [{ key: 'audio', label: t('ai.speech.newFromAudio'), icon: 'mic' } as const] : []),
])
function onNew(key: string) {
  if (key === 'audio') audioOpen.value = true
  else dialog.value = key === 'import' ? 'import' : 'new'
}
const target = ref<ScriptSummary | null>(null)
// A row's options menu: rename and download open their dialog; the others run at once.
const { show } = useToast()
const limitError = useLimitError()
const busy = ref(false)
async function onAction(s: ScriptSummary, action: ScriptAction) {
  if (action === 'rename' || action === 'download') {
    target.value = s
    dialog.value = action
    return
  }
  if (busy.value) return
  busy.value = true
  try {
    if (action === 'duplicate') {
      const copy = await store.duplicate(s.id)
      show(t('library.duplicated', { title: copy.title }))
    } else if (action === 'pin') {
      await store.setPinned(s.id, !s.pinned)
      show(s.pinned ? t('library.unpinnedToast') : t('library.pinnedToast'))
    } else {
      await store.setArchived(s.id, !s.archivedAt)
      show(s.archivedAt ? t('library.restoredToast') : t('library.archivedToast'))
    }
  } catch (e) {
    // Release 2: over a plan limit (duplicate, restore) the limit dialog explains it (R2-2).
    if (!limitError.handle(e)) show(errorText(e), 'error')
  } finally {
    busy.value = false
  }
}
// Keep the dialog's script in sync after optimistic changes (pin label, archive state).
watch(() => store.items, () => {
  if (target.value) target.value = store.items.find(s => s.id === target.value!.id) ?? null
}, { deep: true })

const filters = computed<{ value: ScriptFilter; label: string }[]>(() => [
  { value: 'all', label: t('library.filter.all') },
  { value: 'pinned', label: t('library.filter.pinned') },
  { value: 'archived', label: t('library.filter.archived') },
])

const sortOptions = computed<{ value: ScriptSort; label: string }[]>(() =>
  (['title', 'takes', 'recent'] as const).map(value => ({ value, label: t(`library.sort.${value}`) })))
const sortModel = computed<ScriptSort | null>({
  get: () => store.sort,
  set: (v) => {
    if (v) store.setSort(v)
  },
})

const search = ref(store.query)
const searchOpen = ref(!!store.query)
const searchInput = ref<HTMLInputElement>()
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (q) => {
  clearTimeout(timer)
  timer = setTimeout(() => store.setQuery(q), 200)
})
async function toggleSearch() {
  searchOpen.value = !searchOpen.value
  if (searchOpen.value) {
    await nextTick()
    searchInput.value?.focus()
  } else {
    search.value = ''
  }
}

// Skeletons for waits after the first load; a fast answer never flashes them. A new filter or search shows row
// skeletons only when none of the scripts already here belong to it (instead of a wrong "no scripts" line); rows that
// do belong stay, so a row someone is about to use is never swapped out from under them.
const reloadWaiting = useSkeletonDelay(() => store.reloading)
const listWaiting = computed(() => reloadWaiting.value && !store.visible.length)
const moreWaiting = useSkeletonDelay(() => store.loadingMore, 0)

const emptyText = computed(() => {
  if (store.query.trim()) return t('library.noResults', { q: store.query.trim() })
  if (store.filter === 'pinned') return t('library.noPinned')
  if (store.filter === 'archived') return t('library.noArchived')
  return ''
})
</script>

<template>
  <div class="lib">
    <!-- The empty library (6:22) has no page header: its card carries the actions. -->
    <header v-if="!(store.status === 'ready' && !store.hasAny)" class="head">
      <h1>{{ t('nav.scripts') }}</h1>
      <div class="head-acts">
        <span v-if="activeCap && store.status === 'ready'" class="cap" :class="{ full: activeCap.n >= activeCap.max }">{{ t('limits.activeCount', { n: activeCap.n, max: activeCap.max }) }}</span>
        <UiMenu trigger-class="new-btn" :items="newItems" :label="t('library.new')" data-testid="new-menu" @select="onNew">
          <template #trigger>{{ t('library.new') }}<UiGlyph name="chevron-down" :size="16" /></template>
        </UiMenu>
      </div>
    </header>

    <ProEndingBanner class="pro-end" />

    <!-- Loading -->
    <!-- Loading: the same two columns as the library — the last-opened card and the list (heading, search, filters, rows). -->
    <SkeletonRegion v-if="store.status === 'idle' || store.status === 'loading'" class="body" data-testid="library-skeleton">
      <LastOpenedSkeleton class="card-skel" />
      <div class="list-col">
        <div class="list-head"><UiSkeleton h="37px" w="34%" r="8px" /></div>
        <UiSkeleton class="search-skel" h="48px" r="12px" />
        <div class="tools">
          <span class="pills-skel"><UiSkeleton v-for="w in ['64px', '84px', '92px']" :key="w" h="36px" :w="w" r="999px" /></span>
          <UiSkeleton h="16px" w="72px" r="4px" />
        </div>
        <SkeletonRows variant="plain" :count="5" height="76px" lead="square" title-h="21px" meta-h="14px" trail="menu" />
      </div>
    </SkeletonRegion>

    <!-- Error -->
    <UiBanner v-else-if="store.status === 'error'" tone="error" class="err">
      {{ errorText(store.error) }}
      <template #action><UiButton size="sm" tone="secondary" @click="store.load(true)">{{ t('common.retry') }}</UiButton></template>
    </UiBanner>

    <!-- Empty library (6:22) -->
    <section v-else-if="!store.hasAny" class="first">
      <img src="/brand/ta-mark.svg" alt="" width="67" height="62">
      <h2>{{ t('library.emptyTitle') }}</h2>
      <p>{{ t('library.emptyLede') }}</p>
      <div class="first-acts">
        <UiButton @click="dialog = 'new'">{{ t('library.new') }}</UiButton>
        <UiButton tone="secondary" @click="dialog = 'import'">{{ t('library.importFile') }}</UiButton>
        <UiButton v-if="plan.cloudSpeech" tone="secondary" @click="audioOpen = true">{{ t('ai.speech.newFromAudio') }}</UiButton>
      </div>
    </section>

    <div v-else class="body">
      <LastOpenedCard v-if="store.lastOpened && store.filter !== 'archived'" class="last" :script="store.lastOpened" />

      <section class="list-col" aria-labelledby="all-h">
        <div class="list-head">
          <h2 id="all-h">{{ t('library.all') }}</h2>
          <button type="button" class="search-toggle" :aria-expanded="searchOpen" :aria-label="t('library.search')" @click="toggleSearch">
            <UiGlyph name="search" :size="20" />
          </button>
        </div>

        <label class="search" :class="{ open: searchOpen }">
          <UiGlyph name="search" :size="18" />
          <span class="visually-hidden">{{ t('library.search') }}</span>
          <!-- Empty, dir="auto" resolves to LTR and drags the placeholder with it; so it only applies to typed text. -->
          <input ref="searchInput" v-model="search" type="search" :placeholder="t('library.search')" :dir="search ? 'auto' : undefined">
        </label>

        <div class="tools">
          <UiPills v-model="store.filter" :options="filters" :label="t('library.filterLabel')" />
          <div class="sort">
            <UiSelect v-model="sortModel" class="sort-by" :options="sortOptions" size="sm" :label="t('library.sortTitle')" data-testid="sort-by" />
            <button
              type="button"
              class="sort-dir"
              :aria-label="t('library.sortReverse')"
              :title="t('library.sortReverse')"
              :aria-pressed="store.reversed"
              :data-dir="store.ascending ? 'asc' : 'desc'"
              data-testid="sort-dir"
              @click="store.reversed = !store.reversed"
            >
              <UiGlyph :name="store.ascending ? 'sort-asc' : 'sort-desc'" :size="18" />
            </button>
          </div>
        </div>

        <!-- A new filter or search with nothing to show yet: rows' shape until the new page lands. -->
        <SkeletonRegion v-if="listWaiting">
          <SkeletonRows variant="plain" :count="4" height="76px" lead="square" title-h="21px" meta-h="14px" trail="menu" />
        </SkeletonRegion>
        <ul v-else-if="store.visible.length" class="rows">
          <ScriptRow
            v-for="s in store.visible"
            :key="s.id"
            :script="s"
            :current="s.id === store.lastOpened?.id && store.filter !== 'archived'"
            :takes="takes.countByScript.get(s.id) ?? 0"
            @action="a => onAction(s, a)"
          />
        </ul>
        <p v-else-if="!store.reloading" class="none">{{ emptyText }}</p>
        <!-- Load more: the next rows' shape appended under the list while the page arrives. -->
        <SkeletonRegion v-if="moreWaiting && !listWaiting" data-testid="library-more-skeleton">
          <SkeletonRows variant="plain" :count="3" height="76px" lead="square" title-h="21px" meta-h="14px" trail="menu" />
        </SkeletonRegion>
        <UiBanner v-if="store.moreError && !listWaiting" tone="error" data-testid="scripts-more-error">{{ errorText(store.moreError) }}</UiBanner>
        <div v-if="store.visible.length && store.hasMore && !listWaiting" class="more-row">
          <UiButton tone="secondary" :loading="store.loadingMore" data-testid="scripts-load-more" @click="store.loadMore()">{{ t('library.loadMore') }}</UiButton>
        </div>
      </section>
    </div>

    <LibraryDialogs v-model:mode="dialog" :target="target" />
    <AudioImportDialog v-if="audioOpen" v-model:open="audioOpen" />
  </div>
</template>

<style scoped>
.lib {
  padding-block: 39px 0;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tilw-space-16);
  padding-block-end: 26px;
  border-block-end: 1px solid var(--tilw-border-subtle);
}
h1 {
  font: 700 52px/1.36 var(--tilw-font-ar);
}
.head-acts {
  display: flex;
  align-items: center;
  gap: 40px;
}
.cap {
  color: var(--tilw-text-muted);
  font: 400 15px/1.36 var(--tilw-font-ar);
}
.cap.full {
  color: var(--tilw-action-primary);
  font-weight: 500;
}
.pro-end {
  margin-block-start: 20px;
}
/* The menu trigger looks like a primary UiButton. */
.head-acts :deep(.new-btn) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-block-size: var(--tilw-control-h);
  min-inline-size: 120px;
  padding-inline: var(--tilw-space-24);
  border: 0;
  border-radius: var(--tilw-radius-control);
  background: var(--tilw-action-solid);
  color: var(--tilw-text-on-solid);
  font: var(--tilw-type-control);
  white-space: nowrap;
  cursor: pointer;
}
.head-acts :deep(.new-btn:hover) {
  background: color-mix(in srgb, var(--tilw-action-solid) 88%, #000);
}
.head-acts :deep(.new-btn:focus-visible) {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
.body {
  display: grid;
  grid-template-columns: minmax(0, 614fr) minmax(0, 504fr);
  gap: 46px;
  align-items: start;
  padding-block-start: 35px;
}
/* RTL: the card sits at the start (right), the list at the end (left), as in 6:18. */
.last,
.card-skel {
  order: -1;
}
.list-col {
  display: grid;
  gap: 18px;
}
.pills-skel {
  display: flex;
  gap: 8px;
}
.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.list-head h2 {
  font: 700 27px/1.36 var(--tilw-font-ar);
}
.search-toggle {
  display: none;
  place-items: center;
  inline-size: var(--tilw-hit);
  block-size: var(--tilw-hit);
  border: 0;
  border-radius: 10px;
  background: none;
  color: var(--tilw-text-ink);
}
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  block-size: 48px;
  padding-inline: 16px;
  border-radius: 12px;
  background: var(--tilw-surface-white);
  color: var(--tilw-text-muted);
}
.search:focus-within {
  box-shadow: 0 0 0 2px var(--tilw-focus-ring);
}
.search input {
  flex: 1;
  min-inline-size: 0;
  border: 0;
  background: none;
  outline: none;
  font: 400 17px/1.36 var(--tilw-font-ar);
  color: var(--tilw-text-ink);
}
.search input::placeholder {
  color: var(--tilw-text-muted);
}
.tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.sort {
  display: flex;
  align-items: center;
  gap: 6px;
}
.sort-by {
  inline-size: 150px;
}
.sort-dir {
  display: grid;
  place-items: center;
  inline-size: 36px;
  block-size: 36px;
  padding: 0;
  border: 1px solid var(--tilw-control-edge);
  border-radius: var(--tilw-radius-field);
  background: var(--tilw-control-fill);
  color: var(--tilw-text-ink);
  cursor: pointer;
}
.sort-dir:hover {
  border-color: var(--tilw-control-edge-hover);
  background: var(--tilw-control-fill-hover);
}
.sort-dir:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
.rows {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.more-row {
  display: flex;
  justify-content: center;
  padding-block: 20px 8px;
}
.none {
  padding: 24px 14px;
  color: var(--tilw-text-muted);
  font: var(--tilw-type-body);
}
.err {
  margin-block-start: 32px;
}

/* 6:22 empty library */
.first {
  display: grid;
  justify-items: center;
  gap: 18px;
  max-inline-size: 744px;
  margin: 74px auto 0;
  padding: 47px 32px 64px;
  border-radius: 18px;
  background: var(--tilw-surface-white);
  text-align: center;
}
.first h2 {
  margin-block-start: 8px;
  font: 700 36px/1.36 var(--tilw-font-ar);
}
.first p {
  font: 400 19px/1.36 var(--tilw-font-ar);
  color: var(--tilw-text-muted);
}
.first-acts {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 23px;
  margin-block-start: 24px;
}
.first-acts :deep(.ui-btn) {
  min-inline-size: 168px;
}

@media (max-width: 1000px) {
  .body {
    grid-template-columns: minmax(0, 1fr);
    gap: 28px;
  }
}
/* Phone (6:20) */
@media (max-width: 760px) {
  .lib {
    padding-block-start: 20px;
  }
  .head {
    padding-block-end: 16px;
    border: 0;
  }
  h1 {
    font-size: 35px;
  }
  .body {
    padding-block-start: 4px;
  }
  .search-toggle {
    display: grid;
  }
  .search:not(.open),
  .search-skel {
    display: none;
  }
  .list-head h2 {
    font-size: 24px;
  }
  .first {
    margin-block-start: 24px;
    padding: 36px 20px 40px;
  }
  .first h2 {
    font-size: 28px;
  }
}
</style>
