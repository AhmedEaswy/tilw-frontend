<script setup lang="ts">
/**
 * Feature 006 (D8 ledger grant): find a person by email or name and pick one. A listbox under the input; arrows and
 * Enter work from the keyboard.
 */
import type { AdminUserRow } from '~/services/types'

const model = defineModel<AdminUserRow | null>({ default: null })
defineProps<{ label: string }>()
const { t } = useI18n()
const q = ref('')
const rows = ref<AdminUserRow[]>([])
const active = ref(0)
const id = useId()
let timer: ReturnType<typeof setTimeout> | null = null
let seq = 0
watch(q, (v) => {
  if (timer) clearTimeout(timer)
  if (model.value && v !== model.value.email) model.value = null
  if (!v.trim()) {
    rows.value = []
    return
  }
  timer = setTimeout(async () => {
    const mine = ++seq
    try {
      const page = await useServices().admin.users({ q: v.trim() }, null, 8)
      if (mine === seq) {
        rows.value = page.items
        active.value = 0
      }
    } catch {
      if (mine === seq) rows.value = []
    }
  }, 200)
})
function pick(r: AdminUserRow) {
  model.value = r
  q.value = r.email
  rows.value = []
}
function key(e: KeyboardEvent) {
  if (!rows.value.length) return
  if (e.key === 'ArrowDown') active.value = (active.value + 1) % rows.value.length
  else if (e.key === 'ArrowUp') active.value = (active.value - 1 + rows.value.length) % rows.value.length
  else if (e.key === 'Enter') pick(rows.value[active.value]!)
  else return
  e.preventDefault()
}
</script>

<template>
  <div class="picker">
    <label class="adm-label">
      {{ label }}
      <input
        v-model="q"
        class="adm-input adm-ltr"
        type="search"
        role="combobox"
        autocomplete="off"
        :aria-expanded="rows.length > 0"
        :aria-controls="`${id}-list`"
        :aria-activedescendant="rows.length ? `${id}-${active}` : undefined"
        :placeholder="t('admin.picker.placeholder')"
        @keydown="key"
      >
    </label>
    <ul v-if="rows.length" :id="`${id}-list`" class="list" role="listbox">
      <li
        v-for="(r, i) in rows"
        :id="`${id}-${i}`"
        :key="r.id"
        role="option"
        :aria-selected="i === active"
        @mousedown.prevent="pick(r)"
      >
        <span class="adm-person"><b>{{ r.name }}</b><small class="adm-ltr">{{ r.email }}</small></span>
        <span class="adm-muted">{{ r.plan }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.picker {
  position: relative;
}
.list {
  position: absolute;
  inset-inline: 0;
  z-index: 5;
  display: grid;
  margin-block-start: 4px;
  padding: 6px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: 10px;
  background: var(--tilw-surface-white);
  box-shadow: var(--tilw-shadow-pop);
  list-style: none;
}
li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
}
li[aria-selected='true'] {
  background: var(--tilw-surface-selected);
}
</style>
