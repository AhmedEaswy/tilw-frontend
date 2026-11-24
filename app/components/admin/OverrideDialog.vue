<script setup lang="ts">
/**
 * Feature 006 (D4): a personal limit value that wins over the plan until an optional end. Int limits can be
 * "unlimited" (null), bool limits on/off, list limits a comma-separated list. "Remove" goes back to the plan.
 */
import { isPortError, type AdminLimitRow } from '~/services/types'
import { dayToIso } from '~/utils/admin'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ userId: string; limit: AdminLimitRow | null }>()
const { t, locale } = useI18n()
const user = useAdminUserStore()
const errorText = useErrorText()
const { show } = useToast()

const intVal = ref('')
const unlimited = ref(false)
const boolVal = ref(false)
const listVal = ref('')
const ends = ref('')
const note = ref('')
const error = ref('')
watch(open, (v) => {
  if (!v || !props.limit) return
  const val = props.limit.value
  unlimited.value = props.limit.type === 'int' && val === null
  intVal.value = typeof val === 'number' ? String(val) : ''
  boolVal.value = val === true
  listVal.value = Array.isArray(val) ? val.join(', ') : ''
  ends.value = ''
  note.value = ''
  error.value = ''
})
const label = computed(() => (props.limit ? (locale.value === 'ar' ? props.limit.labelAr : props.limit.labelEn) : ''))
const value = computed(() => {
  const l = props.limit
  if (!l) return undefined
  if (l.type === 'bool') return boolVal.value
  if (l.type === 'list') return listVal.value.split(',').map(s => s.trim()).filter(Boolean)
  if (unlimited.value) return null
  const n = Number(intVal.value)
  return intVal.value !== '' && Number.isInteger(n) && n >= 0 ? n : undefined
})

async function save() {
  if (!props.limit || value.value === undefined) return
  error.value = ''
  try {
    await user.act('override', () => useServices().admin.setOverride(props.userId, props.limit!.key, { value: value.value!, endsAt: dayToIso(ends.value, true) ?? null, note: note.value.trim() || null }))
    show(t('admin.override.saved', { limit: label.value }), 'success')
    open.value = false
  } catch (e) {
    error.value = isPortError(e, 'validation') ? t('admin.override.invalid') : errorText(e)
  }
}
async function remove() {
  if (!props.limit) return
  try {
    await user.act('override', () => useServices().admin.removeOverride(props.userId, props.limit!.key))
    show(t('admin.override.removed', { limit: label.value }), 'success')
    open.value = false
  } catch (e) {
    error.value = errorText(e)
  }
}
</script>

<template>
  <UiDialog v-model:open="open" :title="t('admin.override.title', { limit: label })">
    <form v-if="limit" class="adm-form" @submit.prevent="save">
      <label v-if="limit.type === 'int'" class="adm-label">
        {{ t('admin.override.value') }}
        <input v-model="intVal" class="adm-input adm-ltr" type="number" min="0" step="1" :disabled="unlimited">
      </label>
      <label v-if="limit.type === 'int'" class="chk"><input v-model="unlimited" type="checkbox"> {{ t('admin.limits.unlimited') }}</label>
      <label v-else-if="limit.type === 'bool'" class="chk"><input v-model="boolVal" type="checkbox"> {{ t('admin.override.on') }}</label>
      <label v-else class="adm-label">
        {{ t('admin.override.list') }}
        <input v-model="listVal" class="adm-input adm-ltr" type="text">
      </label>
      <label class="adm-label">
        {{ t('admin.override.endsAt') }}
        <input v-model="ends" class="adm-input" type="date">
      </label>
      <label class="adm-label">
        {{ t('admin.override.note') }}
        <textarea v-model="note" class="adm-input" dir="auto" maxlength="500" />
      </label>
      <p v-if="error" class="adm-note error" role="alert">{{ error }}</p>
      <div class="adm-dialog-actions">
        <button v-if="limit.overridden" type="button" class="adm-link danger rm" @click="remove">{{ t('admin.override.remove') }}</button>
        <button type="button" class="adm-btn" @click="open = false">{{ t('common.cancel') }}</button>
        <button type="submit" class="adm-btn primary" :disabled="value === undefined || user.busy === 'override'">{{ t('common.save') }}</button>
      </div>
    </form>
  </UiDialog>
</template>

<style scoped>
.chk {
  display: flex;
  gap: 8px;
  align-items: center;
  font: 500 14px/1.4 var(--tilw-font-ar);
}
.rm {
  margin-inline-end: auto;
}
</style>
