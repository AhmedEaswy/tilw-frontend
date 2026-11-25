<script setup lang="ts">
/**
 * Feature 005, US4 (A6 key states: saved in `296:380`, locked / refused / empty in `296:532`): the person's own text
 * key. The key text lives only in this form's field until it is sent; the field is cleared after saving and the key is
 * never shown again, only the provider and its last four characters (SC-003). Own keys never cover speech.
 */
import { AI_RULES, isPortError, type AiProvider } from '~/services/types'
import { PROVIDER_NAMES } from '~/components/brand/ProviderMark.vue'

const { t, locale } = useI18n()
const ai = useAiStore()
const plan = usePlanStore()
const upgrade = useUpgrade()
const limitError = useLimitError()
const { show } = useToast()
const { errorCopy } = useAiText()
const titleId = useId()

const provider = ref<AiProvider>('anthropic')
const secret = ref('')
const editing = ref(false)
const busy = ref<'' | 'save' | 'check' | 'delete'>('')
const fieldError = ref('')
const message = ref<{ title: string; text: string } | null>(null)
const confirming = ref(false)

// Until the saved key is known the card shows its shape, not the empty "add a key" form (which would be wrong when
// a key exists). If the read fails the form shows, as before.
const keyFailed = ref(false)
const keyWaiting = computed(() => !ai.keyLoaded && !keyFailed.value)
onMounted(() => {
  if (!ai.keyLoaded) void ai.loadKey().catch(() => (keyFailed.value = true))
})

const allowed = computed(() => plan.limit('byok.allowed') !== false)
const key = computed(() => ai.key)
const showForm = computed(() => !keyWaiting.value && allowed.value && (!key.value || editing.value))
const providerName = (p: AiProvider) => PROVIDER_NAMES[p]
const providers: AiProvider[] = ['anthropic', 'openai']
// Provider choice: a radio group with the marks (same keys as UiSegmented: ←/→ follow reading direction).
function onProviderKey(e: KeyboardEvent) {
  const rtl = getComputedStyle(e.currentTarget as Element).direction === 'rtl'
  const step = e.key === (rtl ? 'ArrowLeft' : 'ArrowRight') ? 1 : e.key === (rtl ? 'ArrowRight' : 'ArrowLeft') ? -1 : 0
  if (!step) return
  e.preventDefault()
  const i = providers.indexOf(provider.value)
  provider.value = providers[(i + step + providers.length) % providers.length]!
  nextTick(() => (e.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus())
}
const placeholder = computed(() => (provider.value === 'openai' ? 'sk-…' : 'sk-ant-…'))

async function save() {
  fieldError.value = ''
  message.value = null
  const k = secret.value.trim()
  if (k.length < AI_RULES.ownKeyMin || k.length > AI_RULES.ownKeyMax) {
    fieldError.value = t('ai.key.invalid')
    return
  }
  busy.value = 'save'
  try {
    await ai.saveKey(provider.value, k)
    editing.value = false
    show(t('ai.key.saved'), 'success')
  } catch (e) {
    if (isPortError(e, 'validation')) fieldError.value = t('ai.key.invalid')
    else if (!limitError.handle(e)) message.value = errorCopy(e)
  } finally {
    // The key never stays in the page, saved or not.
    secret.value = ''
    busy.value = ''
  }
}

async function check() {
  message.value = null
  busy.value = 'check'
  try {
    const k = await ai.checkKey()
    show(k.checkOk ? t('ai.key.checkOk') : t('ai.key.checkFail'), k.checkOk ? 'success' : 'error')
  } catch (e) {
    message.value = errorCopy(e)
  } finally {
    busy.value = ''
  }
}

async function remove() {
  busy.value = 'delete'
  try {
    await ai.deleteKey()
    confirming.value = false
    show(t('ai.key.deleted'))
  } catch (e) {
    confirming.value = false
    message.value = errorCopy(e)
  } finally {
    busy.value = ''
  }
}

function startReplace() {
  provider.value = key.value?.provider ?? 'anthropic'
  secret.value = ''
  fieldError.value = ''
  editing.value = true
}
</script>

<template>
  <section class="key" :aria-labelledby="titleId" data-testid="own-key">
    <h2 :id="titleId">{{ t('ai.key.title') }}</h2>

    <SkeletonRegion v-if="keyWaiting" class="key-wait" data-testid="own-key-skeleton">
      <UiSkeleton h="14px" w="90%" r="4px" />
      <UiSkeleton h="14px" w="60%" r="4px" />
      <span class="prov-skel"><UiSkeleton h="40px" r="10px" /><UiSkeleton h="40px" r="10px" /></span>
      <UiSkeleton h="48px" r="10px" />
      <UiSkeleton h="48px" r="12px" />
    </SkeletonRegion>

    <!-- locked by plan -->
    <template v-if="!keyWaiting && !allowed && !key">
      <p class="muted">{{ t('ai.key.lockedText') }}</p>
      <UiButton v-if="!plan.isPro && upgrade.available.value" block @click="upgrade.open()">{{ t('ai.common.upgrade') }}</UiButton>
    </template>

    <!-- saved -->
    <template v-if="key && !editing">
      <div class="saved">
        <b dir="ltr" class="masked">
          <ProviderMark :provider="key.provider" :size="20" />
          <span data-testid="own-key-masked">{{ providerName(key.provider) }} · ••••{{ key.last4 }}</span>
        </b>
        <span class="state" :class="key.checkOk ? 'ok' : 'bad'">{{ key.checkOk ? t('ai.key.works') : t('ai.key.failing') }}</span>
      </div>
      <p class="muted">
        {{ t('ai.key.checked', { when: relativeTime(key.checkedAt, locale) }) }}<template v-if="key.usable"> · {{ t('ai.key.noCredits') }}</template>
      </p>
      <p v-if="key.reason" class="muted warn">{{ t('ai.key.notUsed') }}</p>
      <div class="acts">
        <UiButton size="sm" tone="secondary" :loading="busy === 'check'" @click="check">{{ t('ai.key.check') }}</UiButton>
        <UiButton v-if="allowed" size="sm" tone="secondary" @click="startReplace">{{ t('ai.key.replace') }}</UiButton>
        <UiButton size="sm" tone="ghost" @click="confirming = true">{{ t('ai.key.delete') }}</UiButton>
      </div>
    </template>

    <!-- empty or replacing -->
    <form v-if="showForm" class="form" autocomplete="off" @submit.prevent="save">
      <p v-if="!key" class="muted">{{ t('ai.key.lede') }}</p>
      <div class="prov" role="radiogroup" :aria-label="t('ai.key.provider')" @keydown="onProviderKey">
        <button
          v-for="p in providers"
          :key="p"
          type="button"
          role="radio"
          :aria-checked="provider === p"
          :tabindex="provider === p ? 0 : -1"
          @click="provider = p"
        >
          <ProviderMark :provider="p" :size="18" />
          <span lang="en">{{ providerName(p) }}</span>
        </button>
      </div>
      <UiField
        v-model="secret"
        type="password"
        name="ai-key"
        autocomplete="off"
        :label="t('ai.key.field')"
        :placeholder="placeholder"
        :error="fieldError"
        :maxlength="AI_RULES.ownKeyMax"
      />
      <UiButton type="submit" block :loading="busy === 'save'" data-testid="own-key-save">{{ t('ai.key.save') }}</UiButton>
      <UiButton v-if="editing" block tone="ghost" @click="editing = false">{{ t('ai.common.cancel') }}</UiButton>
    </form>

    <AiMessage v-if="message" :title="message.title" :text="message.text" tone="error" data-testid="own-key-error" />
    <p class="note">{{ t('ai.key.speechNote') }}</p>

    <UiDialog v-model:open="confirming" :title="t('ai.key.deleteTitle')">
      <p>{{ t('ai.key.deleteText') }}</p>
      <template #actions>
        <UiButton tone="danger" :loading="busy === 'delete'" @click="remove">{{ t('ai.key.delete') }}</UiButton>
        <UiButton tone="secondary" @click="confirming = false">{{ t('ai.common.cancel') }}</UiButton>
      </template>
    </UiDialog>
  </section>
</template>

<style scoped>
.key-wait {
  display: grid;
  gap: 12px;
}
.prov-skel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.key {
  display: grid;
  gap: 12px;
  align-content: start;
  padding: 24px 28px;
  border-radius: 12px;
  background: var(--tilw-surface-white);
}
h2 {
  margin: 0;
  font: 700 20px/1.4 var(--tilw-font-ar);
}
.muted,
.note {
  margin: 0;
  color: var(--tilw-text-muted);
  font: 400 14px/1.6 var(--tilw-font-ar);
}
.note {
  font-size: 13px;
}
.warn {
  color: var(--tilw-action-primary);
}
.saved {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.saved b {
  font: 500 17px/1.4 var(--tilw-font-lat);
}
.masked {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.prov {
  display: flex;
  padding: 3px;
  min-block-size: var(--tilw-hit);
  border-radius: var(--tilw-radius-field);
  background: var(--tilw-surface-quiet);
}
.prov button {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-inline-size: 0;
  padding-inline: var(--tilw-space-12);
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--tilw-text-muted);
  font: 500 16px/1.34 var(--tilw-font-lat);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}
.prov button[aria-checked='true'] {
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.prov button:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 1px;
}
.state {
  font: 500 14px/1.4 var(--tilw-font-ar);
}
.state.ok {
  color: var(--tilw-status-success);
}
.state.bad {
  color: var(--tilw-status-error);
}
.acts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.form {
  display: grid;
  gap: 12px;
}
</style>
