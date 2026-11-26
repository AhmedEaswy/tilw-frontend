<script setup lang="ts">
/**
 * The WhatsApp number for an upgrade request: sending it creates the request (or updates the pending one) and the
 * admin writes to the person. Opened with `useUpgrade().askPhone(period)`; mounted by `UpgradeDialog`.
 */
import { isPortError } from '~/services/types'
import { isolateLtr, normalizePhone } from '~/utils/phone'

const { t } = useI18n()
const upgrade = useUpgrade()
const plan = usePlanStore()
const route = useRoute()
const { show } = useToast()
const errorText = useErrorText()

const open = computed({ get: () => upgrade.phonePeriod.value !== null, set: v => !v && upgrade.closePhone() })
const formId = useId()
const phone = ref('')
const fieldError = ref('')
const error = ref('')
const busy = ref(false)

watch(open, (v) => {
  if (!v) return
  phone.value = plan.my?.pendingRequest?.phone ?? ''
  fieldError.value = ''
  error.value = ''
}, { immediate: true })
watch(phone, () => (fieldError.value = ''))

async function send() {
  const period = upgrade.phonePeriod.value
  if (!period || busy.value) return
  const number = normalizePhone(phone.value)
  if (!number) {
    fieldError.value = t('upgrade.phoneInvalid')
    return
  }
  busy.value = true
  error.value = ''
  try {
    const { request } = await plan.requestUpgrade(period, number)
    upgrade.close()
    show(t('upgrade.sent', { phone: isolateLtr(number), ref: isolateLtr(request.reference) }), 'success', 7000)
    if (route.path !== '/app/settings/plan') await navigateTo('/app/settings/plan')
  } catch (e) {
    if (isPortError(e, 'validation') && e.fields?.phone) fieldError.value = t('upgrade.phoneInvalid')
    else error.value = errorText(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiDialog v-model:open="open" class="phone-dialog" :title="t('upgrade.phoneTitle')">
    <UiBanner v-if="error" tone="error">{{ error }}</UiBanner>
    <p class="lede">{{ t('upgrade.phoneLede') }}</p>
    <form :id="formId" novalidate @submit.prevent="send">
      <UiField
        v-model="phone"
        type="tel"
        ltr
        name="phone"
        autocomplete="tel"
        placeholder="+20 100 123 4567"
        :maxlength="32"
        required
        :label="t('upgrade.phoneLabel')"
        :hint="t('upgrade.phoneHint')"
        :error="fieldError"
      />
    </form>

    <template #actions>
      <UiButton type="submit" :form="formId" :loading="busy">{{ t('upgrade.send') }}</UiButton>
      <UiButton tone="secondary" @click="upgrade.closePhone()">{{ t('library.back') }}</UiButton>
    </template>
  </UiDialog>
</template>

<style scoped>
.phone-dialog {
  inline-size: 560px;
}
.lede {
  margin: 0;
}
</style>
