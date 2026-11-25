<script setup lang="ts">
/**
 * Feature 006 (D8 ledger): find a person by email or name and pick one — `UiAutocomplete` over the admin people
 * search (8 at a time), with a visible label. v-model is the picked row or null (typing something else clears it).
 */
import type { AdminUserRow } from '~/services/types'
import type { UiOption } from '~/utils/uiControls'

const model = defineModel<AdminUserRow | null>({ default: null })
const props = withDefaults(defineProps<{ label: string; size?: 'sm' | 'md'; inline?: boolean }>(), { size: 'sm', inline: false })
const { t } = useI18n()
const id = useId()

const option = (r: AdminUserRow): UiOption<string> => ({ value: r.id, label: r.name, hint: r.email, data: r })
const source = (q: string) => useServices().admin.users({ q }, null, 8).then(p => p.items.map(option))
const selected = computed(() => (model.value ? [option(model.value)] : []))
const value = computed<string | null>({
  get: () => model.value?.id ?? null,
  set: (v) => {
    if (!v) model.value = null
  },
})
function pick(o: UiOption<string>) {
  model.value = o.data as AdminUserRow
}
</script>

<template>
  <div class="apf" :class="{ inline: props.inline }">
    <label :for="id" class="lbl">{{ label }}</label>
    <UiAutocomplete
      :id="id"
      v-model="value"
      :source="source"
      :selected-options="selected"
      :size="size"
      :placeholder="t('admin.picker.placeholder')"
      @select="pick"
    />
  </div>
</template>

<style scoped>
.apf {
  display: grid;
  gap: 6px;
}
.lbl {
  font: 500 13px/1.4 var(--tilw-font-ar);
}
.apf.inline {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}
.apf.inline .lbl {
  color: var(--tilw-text-muted);
  font-weight: 500;
}
</style>
