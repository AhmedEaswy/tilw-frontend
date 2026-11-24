<script setup lang="ts">
/**
 * Feature 006 (D4 `310:674`): confirms an account action. Optional reason (required by the service for suspend and
 * deletion) and, for the strongest actions (owner decision), the person's email typed exactly to enable the button.
 */
import { confirmsEmail } from '~/utils/admin'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{
  title: string
  text: string
  confirmLabel: string
  tone?: 'primary' | 'danger'
  reason?: boolean
  typeToConfirm?: string
  busy?: boolean
  error?: string
}>()
const emit = defineEmits<{ confirm: [reason: string] }>()
const { t } = useI18n()
const reasonText = ref('')
const typed = ref('')
watch(open, (v) => {
  if (v) {
    reasonText.value = ''
    typed.value = ''
  }
})
const matches = computed(() => !props.typeToConfirm || confirmsEmail(typed.value, props.typeToConfirm))
const ready = computed(() => matches.value && (!props.reason || reasonText.value.trim().length > 0) && !props.busy)
function submit() {
  if (ready.value) emit('confirm', reasonText.value.trim())
}
</script>

<template>
  <UiDialog v-model:open="open" :title="title">
    <form class="adm-form" @submit.prevent="submit">
      <p class="txt">{{ text }}</p>
      <label v-if="reason" class="adm-label">
        {{ t('admin.confirm.reason') }}
        <textarea v-model="reasonText" class="adm-input" dir="auto" maxlength="500" required />
      </label>
      <label v-if="typeToConfirm" class="adm-label">
        <span>{{ t('admin.confirm.typeEmail') }} <span class="adm-ltr">{{ typeToConfirm }}</span></span>
        <input v-model="typed" class="adm-input adm-ltr" type="text" autocomplete="off" spellcheck="false" :aria-describedby="`${typeToConfirm}-hint`">
        <span :id="`${typeToConfirm}-hint`" class="adm-hint" aria-live="polite">{{ typed && matches ? t('admin.confirm.matches') : t('admin.confirm.typeHint') }}</span>
      </label>
      <p v-if="error" class="adm-note error" role="alert">{{ error }}</p>
      <div class="adm-dialog-actions">
        <button type="button" class="adm-btn" @click="open = false">{{ t('common.cancel') }}</button>
        <button type="submit" class="adm-btn" :class="tone === 'danger' ? 'danger' : 'primary'" :disabled="!ready">{{ confirmLabel }}</button>
      </div>
    </form>
  </UiDialog>
</template>

<style scoped>
.txt {
  color: var(--tilw-text-muted);
  font: 500 14px/1.6 var(--tilw-font-ar);
}
</style>
