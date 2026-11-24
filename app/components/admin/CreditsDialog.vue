<script setup lang="ts">
/**
 * Feature 006 (D4, D8 ledger): grant credits (positive, optional end) or correct the month (±). Each opening makes one
 * idempotency key, so a double-click or a retry of the same form grants once (backend 005 review fix).
 */
import { isPortError, type CreditEntry } from '~/services/types'
import { dayToIso, newIdempotencyKey } from '~/utils/admin'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ userId: string; name: string; balance?: number }>()
const emit = defineEmits<{ done: [entry: CreditEntry] }>()
const { t } = useI18n()
const errorText = useErrorText()
const { show } = useToast()

const kind = ref<'grant' | 'correction'>('grant')
const amount = ref('50')
const ends = ref('')
const reason = ref('')
const busy = ref(false)
const error = ref('')
let key = newIdempotencyKey()
watch(open, (v) => {
  if (!v) return
  key = newIdempotencyKey()
  kind.value = 'grant'
  amount.value = '50'
  ends.value = ''
  reason.value = ''
  error.value = ''
})
const n = computed(() => Number(amount.value))
const valid = computed(() => Number.isInteger(n.value) && n.value !== 0 && Math.abs(n.value) <= 100_000 && (kind.value === 'correction' || n.value >= 1) && reason.value.trim().length > 0)

async function submit() {
  if (!valid.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const entry = await useServices().admin.addCredits(props.userId, {
      kind: kind.value,
      amount: n.value,
      endsAt: kind.value === 'grant' ? (dayToIso(ends.value, true) ?? null) : undefined,
      reason: reason.value.trim(),
    }, key)
    show(t(kind.value === 'grant' ? 'admin.credits.granted' : 'admin.credits.corrected', { n: n.value, name: props.name }), 'success')
    emit('done', entry)
    open.value = false
  } catch (e) {
    error.value = isPortError(e, 'validation') ? t('admin.credits.invalid') : isPortError(e, 'conflict') ? t('admin.credits.keyConflict') : errorText(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiDialog v-model:open="open" :title="t('admin.credits.title', { name })">
    <form class="adm-form" @submit.prevent="submit">
      <div class="adm-seg" role="group" :aria-label="t('admin.credits.kind')">
        <button type="button" :aria-pressed="kind === 'grant'" @click="kind = 'grant'">{{ t('admin.credits.grant') }}</button>
        <button type="button" :aria-pressed="kind === 'correction'" @click="kind = 'correction'">{{ t('admin.credits.correction') }}</button>
      </div>
      <label class="adm-label">
        {{ t('admin.credits.amount') }}
        <input v-model="amount" class="adm-input adm-ltr" type="number" :min="kind === 'grant' ? 1 : -100000" max="100000" step="1" required>
        <span class="adm-hint">{{ kind === 'grant' ? t('admin.credits.amountHintGrant') : t('admin.credits.amountHintCorrection') }}</span>
      </label>
      <label v-if="kind === 'grant'" class="adm-label">
        {{ t('admin.credits.endsAt') }}
        <input v-model="ends" class="adm-input" type="date">
      </label>
      <label class="adm-label">
        {{ t('admin.credits.reason') }}
        <textarea v-model="reason" class="adm-input" dir="auto" maxlength="500" required />
      </label>
      <p v-if="balance !== undefined && Number.isInteger(n)" class="adm-note">{{ t('admin.credits.after', { n: balance + n }) }}</p>
      <p v-if="error" class="adm-note error" role="alert">{{ error }}</p>
      <div class="adm-dialog-actions">
        <button type="button" class="adm-btn" @click="open = false">{{ t('common.cancel') }}</button>
        <button type="submit" class="adm-btn primary" :disabled="!valid || busy">{{ kind === 'grant' ? t('admin.credits.submitGrant', { n: Number.isInteger(n) ? n : 0 }) : t('admin.credits.submitCorrection') }}</button>
      </div>
    </form>
  </UiDialog>
</template>
