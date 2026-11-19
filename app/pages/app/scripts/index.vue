<script setup lang="ts">
/**
 * Script library (6:18 desktop, 6:20 phone, 6:83 en; pinned 6:112, archived 6:111; empty 6:22).
 * T041–T046.
 */
import type { ScriptSummary } from '~/services/types'
import type { LibraryDialog } from '~/components/scripts/LibraryDialogs.vue'
import type { ScriptFilter } from '~/stores/scripts'

definePageMeta({ layout: 'app' })
const { t } = useI18n()
useHead({ title: () => `${t('nav.scripts')} · tilwprompter` })

const store = useScriptsStore()
const errorText = useErrorText()
onMounted(() => store.load())

const dialog = ref<LibraryDialog>(null)
const target = ref<ScriptSummary | null>(null)
function openActions(s: ScriptSummary) {
  target.value = s
  dialog.value = 'actions'
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
        <button type="button" class="import" @click="dialog = 'import'">{{ t('library.importFile') }}</button>
        <UiButton @click="dialog = 'new'">{{ t('library.new') }}</UiButton>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="store.status === 'idle' || store.status === 'loading'" class="body" aria-busy="true">
      <div class="list-col">
        <UiSkeleton h="36px" w="40%" />
        <UiSkeleton h="48px" r="12px" />
        <UiSkeleton v-for="i in 3" :key="i" h="76px" r="9px" />
      </div>
      <UiSkeleton class="card-skel" h="506px" r="18px" />
    </div>

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
          <input ref="searchInput" v-model="search" type="search" :placeholder="t('library.search')" dir="auto">
        </label>

        <div class="tools">
          <UiPills v-model="store.filter" :options="filters" :label="t('library.filterLabel')" />
          <button type="button" class="sort" @click="dialog = 'sort'">{{ t(`library.sort.${store.sort}`) }}</button>
        </div>

        <ul v-if="store.visible.length" class="rows">
          <ScriptRow
            v-for="s in store.visible"
            :key="s.id"
            :script="s"
            :current="s.id === store.lastOpened?.id && store.filter !== 'archived'"
            @actions="openActions(s)"
          />
        </ul>
        <p v-else class="none">{{ emptyText }}</p>
      </section>
    </div>

    <LibraryDialogs v-model:mode="dialog" :target="target" />
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
.import {
  border: 0;
  background: none;
  color: var(--tilw-action-primary);
  font: 500 16px/1.36 var(--tilw-font-ar);
  padding: 10px 4px;
}
.import:hover {
  text-decoration: underline;
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
  border: 0;
  background: none;
  padding: 8px 4px;
  color: var(--tilw-action-primary);
  font: 500 16px/1.36 var(--tilw-font-ar);
}
.rows {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
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
  .import {
    display: none;
  }
  .body {
    padding-block-start: 4px;
  }
  .search-toggle {
    display: grid;
  }
  .search:not(.open) {
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
