<script setup lang="ts">
/**
 * Feature 006: pick a plan. Up to 8 choices it is a `UiSelect`; more than that, a `UiAutocomplete` that filters the
 * loaded plans by name or key as you type. v-model is the plan's key (or id, with `by="id"`), or null.
 * With `allLabel`, null means "all plans" (a filter): the select gets an "All" first option, the autocomplete is
 * simply left empty.
 */
import type { AdminPlan } from '~/services/types'
import type { UiOption } from '~/utils/uiControls'

const model = defineModel<string | null>({ default: null })
const props = withDefaults(defineProps<{
  plans: readonly AdminPlan[]
  by?: 'key' | 'id'
  allLabel?: string
  /** Extra text after the name (e.g. the price). */
  hint?: (p: AdminPlan) => string | undefined
  id?: string
  size?: 'sm' | 'md'
  error?: boolean | string
}>(), { by: 'key', allLabel: undefined, hint: undefined, id: undefined, size: 'sm', error: false })
const { t, locale } = useI18n()

const name = (p: AdminPlan) => (locale.value === 'ar' ? p.nameAr : p.nameEn) || p.key
const options = computed<UiOption<string>[]>(() => props.plans.map(p => ({ value: props.by === 'id' ? p.id : p.key, label: name(p), hint: props.hint?.(p) ?? p.key })))
const long = computed(() => options.value.length > 8)
const selectOptions = computed(() => (props.allLabel ? [{ value: '', label: props.allLabel }, ...options.value] : options.value))
const selectModel = computed<string | null>({
  get: () => model.value ?? (props.allLabel ? '' : null),
  set: v => (model.value = v || null),
})
const fold = (s: string) => s.toLocaleLowerCase()
async function source(q: string) {
  const term = fold(q.trim())
  return options.value.filter(o => fold(o.label).includes(term) || fold(o.hint ?? '').includes(term))
}
</script>

<template>
  <UiAutocomplete
    v-if="long"
    :id="id"
    v-model="model"
    :source="source"
    :selected-options="options"
    :debounce="0"
    :size="size"
    :error="error"
    :placeholder="allLabel ?? t('admin.plans.pick')"
  />
  <UiSelect v-else :id="id" v-model="selectModel" :options="selectOptions" :size="size" :error="error" :placeholder="t('admin.plans.pick')" />
</template>
