<script setup lang="ts">
/**
 * Feature 006 (D4): change the plan now. Paid plans need a period or a custom end date; a note is required. The plan
 * already in force is not offered. An overlap with a scheduled subscription shows on the end date.
 */
import { isPortError, type AdminUserDetail } from '~/services/types'
import { dayToIso, money } from '~/utils/admin'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ detail: AdminUserDetail }>()
const { t, locale } = useI18n()
const admin = useAdminStore()
const user = useAdminUserStore()
const errorText = useErrorText()
const { show } = useToast()

const planId = ref('')
const mode = ref<'monthly' | 'yearly' | 'custom'>('yearly')
const ends = ref('')
const note = ref('')
const error = ref('')
const fieldError = ref('')
watch(open, async (v) => {
  if (!v) return
  error.value = ''
  fieldError.value = ''
  note.value = ''
  ends.value = ''
  try {
    await admin.loadPlans()
  } catch (e) {
    error.value = errorText(e)
  }
  planId.value = choices.value[0]?.id ?? ''
})
const current = computed(() => props.detail.plan.key ?? 'free')
const choices = computed(() => (admin.plans ?? []).filter(p => p.key !== current.value))
const chosen = computed(() => choices.value.find(p => p.id === planId.value))
const paid = computed(() => !!chosen.value && chosen.value.key !== 'free')
const valid = computed(() => !!chosen.value && note.value.trim().length > 0 && (!paid.value || mode.value !== 'custom' || !!ends.value))
const name = (p: { nameAr: string; nameEn: string }) => (locale.value === 'ar' ? p.nameAr : p.nameEn)

async function submit() {
  if (!valid.value || !chosen.value) return
  // Read before the change: once the plan is in force it leaves the list of choices.
  const target = chosen.value
  const isPaid = paid.value
  error.value = ''
  fieldError.value = ''
  try {
    await user.act('plan', () => useServices().admin.changePlan(props.detail.id, {
      planId: target.id,
      ...(isPaid ? (mode.value === 'custom' ? { endsAt: dayToIso(ends.value, true) } : { period: mode.value }) : {}),
      note: note.value.trim(),
    }))
    show(t('admin.plan.changed', { plan: name(target) }), 'success')
    open.value = false
  } catch (e) {
    if (isPortError(e, 'validation') && e.fields?.endsAt) fieldError.value = e.fields.endsAt === 'overlap' ? t('admin.plan.overlap') : t('admin.plan.endInvalid')
    else error.value = isPortError(e, 'conflict') ? t('admin.plan.sameConflict') : errorText(e)
  }
}
</script>

<template>
  <UiDialog v-model:open="open" :title="t('admin.plan.title', { name: detail.name })">
    <form class="adm-form" @submit.prevent="submit">
      <label class="adm-label">
        {{ t('admin.plan.newPlan') }}
        <select v-model="planId" class="adm-select" required>
          <option v-for="p in choices" :key="p.id" :value="p.id">
            {{ name(p) }}{{ p.key === 'free' ? '' : ` · ${money(p.priceMonthlyCents)} / ${money(p.priceYearlyCents)}` }}
          </option>
        </select>
      </label>
      <div v-if="paid" class="adm-label">
        <span>{{ t('admin.plan.period') }}</span>
        <div class="adm-seg" role="group" :aria-label="t('admin.plan.period')">
          <button v-for="m in (['monthly', 'yearly', 'custom'] as const)" :key="m" type="button" :aria-pressed="mode === m" @click="mode = m">{{ t(`admin.plan.mode.${m}`) }}</button>
        </div>
      </div>
      <label v-if="paid && mode === 'custom'" class="adm-label">
        {{ t('admin.plan.endsAt') }}
        <input v-model="ends" class="adm-input" type="date" required :aria-invalid="!!fieldError">
        <span v-if="fieldError" class="adm-err" role="alert">{{ fieldError }}</span>
      </label>
      <p v-else-if="fieldError" class="adm-err" role="alert">{{ fieldError }}</p>
      <p class="adm-note">{{ paid ? t('admin.plan.effectPaid', { from: detail.plan.nameAr && locale === 'ar' ? detail.plan.nameAr : (detail.plan.nameEn ?? current) }) : t('admin.plan.effectFree') }}</p>
      <label class="adm-label">
        {{ t('admin.plan.note') }}
        <textarea v-model="note" class="adm-input" dir="auto" maxlength="500" required />
      </label>
      <p v-if="error" class="adm-note error" role="alert">{{ error }}</p>
      <div class="adm-dialog-actions">
        <button type="button" class="adm-btn" @click="open = false">{{ t('common.cancel') }}</button>
        <button type="submit" class="adm-btn primary" :disabled="!valid || user.busy === 'plan'">{{ t('admin.plan.submit') }}</button>
      </div>
    </form>
  </UiDialog>
</template>
