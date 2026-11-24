<script setup lang="ts">
/**
 * Pending upgrade request (R2-5 `252:297`): reference with a copy control, period, price, sent date, "Open WhatsApp
 * again" and "Cancel request" (with confirm). Also the fallback when WhatsApp did not open.
 */
import type { UpgradeRequest } from '~/services/types'

const props = defineProps<{ request: UpgradeRequest }>()
const { t, locale } = useI18n()
const { show } = useToast()
const errorText = useErrorText()
const plan = usePlanStore()
const upgrade = useUpgrade()

const confirming = ref(false)
const busy = ref(false)
const fallbackUrl = ref<string | null>(null)

async function copy() {
  try {
    await navigator.clipboard.writeText(props.request.reference)
    show(t('upgrade.copied'))
  } catch {
    show(t('upgrade.copyFailed'), 'error')
  }
}

async function reopen() {
  busy.value = true
  try {
    const r = await upgrade.start(props.request.period)
    fallbackUrl.value = r.kind === 'fallback' ? r.url : null
  } catch (e) {
    show(errorText(e), 'error')
  } finally {
    busy.value = false
  }
}

async function cancel() {
  busy.value = true
  try {
    await plan.cancelRequest()
    confirming.value = false
    show(t('upgrade.cancelled'))
  } catch (e) {
    show(errorText(e), 'error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="req" aria-labelledby="req-h">
    <h2 id="req-h">{{ t('upgrade.pendingTitle') }}</h2>
    <p class="lede">{{ t('upgrade.pendingLede') }}</p>
    <div class="ref">
      <span class="lbl">{{ t('upgrade.reference') }}</span>
      <code dir="ltr">{{ request.reference }}</code>
      <button type="button" class="copy" @click="copy"><UiGlyph name="copy" :size="18" />{{ t('upgrade.copy') }}</button>
    </div>
    <dl>
      <div><dt>{{ t('upgrade.periodLabel') }}</dt><dd>{{ t(`plan.period.${request.period}`) }}</dd></div>
      <div><dt>{{ t('upgrade.price') }}</dt><dd dir="ltr">{{ formatPrice(request.priceCents) }}</dd></div>
      <div><dt>{{ t('upgrade.sentOn') }}</dt><dd>{{ formatDay(request.createdAt, locale) }}</dd></div>
    </dl>
    <p v-if="fallbackUrl !== null" class="fallback">
      {{ t('upgrade.blocked') }} <a :href="fallbackUrl" target="_blank" rel="noopener">{{ t('upgrade.openLink') }}</a>
    </p>
    <div class="acts">
      <UiButton :loading="busy && !confirming" @click="reopen">{{ t('upgrade.reopen') }}</UiButton>
      <button type="button" class="cancel" @click="confirming = true">{{ t('upgrade.cancel') }}</button>
    </div>

    <UiDialog v-model:open="confirming" :title="t('upgrade.cancelTitle')">
      <p>{{ t('upgrade.cancelLede', { ref: request.reference }) }}</p>
      <template #actions>
        <UiButton tone="danger" :loading="busy" @click="cancel">{{ t('upgrade.cancelConfirm') }}</UiButton>
        <UiButton tone="secondary" @click="confirming = false">{{ t('library.back') }}</UiButton>
      </template>
    </UiDialog>
  </section>
</template>

<style scoped>
.req {
  display: grid;
  align-content: start;
  gap: 14px;
  padding: 24px 27px;
  border-radius: 12px;
  background: var(--tilw-surface-white);
}
h2 {
  margin: 0;
  font: 500 21px/1.36 var(--tilw-font-ar);
}
.lede {
  margin: 0;
  color: var(--tilw-text-muted);
  font: 400 16px/1.5 var(--tilw-font-ar);
}
.ref {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--tilw-surface-selected);
}
.ref .lbl {
  color: var(--tilw-text-muted);
  font: 400 15px/1.36 var(--tilw-font-ar);
}
code {
  font: 600 20px/1.2 var(--tilw-font-mono);
  letter-spacing: 0.04em;
}
.copy,
.cancel {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px;
  border: 0;
  background: none;
  color: var(--tilw-action-primary);
  font: 500 15px/1.36 var(--tilw-font-ar);
  cursor: pointer;
}
.copy {
  margin-inline-start: auto;
}
.cancel {
  color: var(--tilw-status-error);
}
dl {
  display: grid;
  grid-template-columns: repeat(3, auto);
  justify-content: start;
  gap: 8px 32px;
  margin: 0;
}
dt {
  color: var(--tilw-text-muted);
  font: 400 14px/1.36 var(--tilw-font-ar);
}
dd {
  margin: 2px 0 0;
  font: 500 17px/1.36 var(--tilw-font-ar);
}
.fallback {
  margin: 0;
  font: 400 15px/1.5 var(--tilw-font-ar);
}
.fallback a {
  color: var(--tilw-action-primary);
}
.acts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.copy:focus-visible,
.cancel:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
@media (max-width: 760px) {
  .req {
    padding: 18px;
  }
  dl {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
