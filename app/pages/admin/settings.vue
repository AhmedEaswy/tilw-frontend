<script setup lang="ts">
/**
 * Admin · settings (feature 006 US6, Figma D10 `313:2122`): the sign-up mode (with a confirmation that says what
 * changes), the platform AI keys (typed once, never shown again: only set/source/last four/when), and feature flags.
 * A key is kept only in the field until it is sent; the field is cleared after saving (SC-004).
 */
import { FLAG_KEY, isPortError, type AdminSettings, type AiKeyState, type SignupMode } from '~/services/types'
import { dateTime, utc } from '~/utils/admin'
import { PROVIDER_NAMES } from '~/components/brand/ProviderMark.vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t, locale } = useI18n()
useHead({ title: () => `${t('admin.nav.settings')} · ${t('admin.title')}` })
const { show } = useToast()
const errorText = useErrorText()

const data = ref<AdminSettings | null>(null)
const error = ref<unknown>(null)
async function load() {
  error.value = null
  try {
    data.value = await useServices().admin.settings()
  } catch (e) {
    error.value = e
  }
}
onMounted(load)

// ---------- sign-up mode ----------
const nextMode = ref<SignupMode | null>(null)
const modeOpen = computed({ get: () => !!nextMode.value, set: v => !v && (nextMode.value = null) })
const modeBusy = ref(false)
/** The switch shows the choice waiting for confirmation, then what the server has. */
const openSignup = computed({
  get: () => (nextMode.value ?? data.value?.signupMode) === 'open',
  set: (on: boolean) => {
    const m: SignupMode = on ? 'open' : 'invite_only'
    nextMode.value = m === data.value?.signupMode ? null : m
  },
})
async function setMode() {
  const m = nextMode.value
  if (!m || modeBusy.value) return
  modeBusy.value = true
  try {
    data.value = await useServices().admin.setSignupMode(m)
    show(t(`admin.settings.mode.done.${m}`), 'success')
    nextMode.value = null
  } catch (e) {
    show(errorText(e), 'error')
  } finally {
    modeBusy.value = false
  }
}

// ---------- platform keys ----------
const editing = ref<AiKeyState['provider'] | null>(null)
const keyText = ref('')
const project = ref('')
const keyError = ref('')
function startKey(p: AiKeyState['provider']) {
  editing.value = p
  keyText.value = ''
  project.value = ''
  keyError.value = ''
}
function cancelKey() {
  editing.value = null
  keyText.value = ''
  project.value = ''
}
const keyBusy = ref(false)
async function saveKey(p: AiKeyState['provider']) {
  if (keyBusy.value) return
  keyBusy.value = true
  keyError.value = ''
  const key = keyText.value.trim()
  try {
    const state = await useServices().admin.setAiKey(p, { key, ...(p === 'deepgram' && project.value.trim() ? { project: project.value.trim() } : {}) })
    keyText.value = ''
    project.value = ''
    editing.value = null
    if (data.value) data.value = { ...data.value, aiKeys: data.value.aiKeys.map(k => (k.provider === p ? state : k)) }
    show(t('admin.settings.keys.saved', { provider: p }), 'success')
  } catch (e) {
    keyError.value = isPortError(e, 'validation') ? (e.fields?.project ? t('admin.settings.keys.projectRequired') : t('admin.settings.keys.invalid')) : errorText(e)
  } finally {
    keyBusy.value = false
  }
}
const removing = ref<AiKeyState['provider'] | null>(null)
const removeOpen = computed({ get: () => !!removing.value, set: v => !v && (removing.value = null) })
const removeBusy = ref(false)
async function removeKey() {
  const p = removing.value
  if (!p || removeBusy.value) return
  removeBusy.value = true
  try {
    const state = await useServices().admin.removeAiKey(p)
    if (data.value) data.value = { ...data.value, aiKeys: data.value.aiKeys.map(k => (k.provider === p ? state : k)) }
    show(t('admin.settings.keys.removed', { provider: p }), 'success')
    removing.value = null
  } catch (e) {
    show(errorText(e), 'error')
  } finally {
    removeBusy.value = false
  }
}
const SOURCE_TONE = { stored: 'success', env: 'info', none: '' } as const

// ---------- flags ----------
const newKey = ref('')
const newDesc = ref('')
const newOn = ref(true)
const flagError = ref('')
const validKey = computed(() => FLAG_KEY.test(newKey.value.trim()))
const addBusy = ref(false)
async function addFlag() {
  if (addBusy.value) return
  flagError.value = ''
  if (!validKey.value) {
    flagError.value = t('admin.settings.flags.keyRule')
    return
  }
  addBusy.value = true
  try {
    await useServices().admin.setFlag(newKey.value.trim(), { enabled: newOn.value, description: newDesc.value.trim() || null })
    newKey.value = ''
    newDesc.value = ''
    newOn.value = true
    await load()
  } catch (e) {
    flagError.value = isPortError(e, 'validation') ? t('admin.settings.flags.keyRule') : errorText(e)
  } finally {
    addBusy.value = false
  }
}
/**
 * Flags with a save in flight and the value asked for: their switch shows it and is busy, so quick toggles can't land
 * out of order; afterwards it shows what the server has again (so a failed save flips back).
 */
const pendingFlags = ref<Map<string, boolean>>(new Map())
async function toggleFlag(key: string, enabled: boolean) {
  if (pendingFlags.value.has(key)) return
  pendingFlags.value = new Map([...pendingFlags.value, [key, enabled]])
  try {
    await useServices().admin.setFlag(key, { enabled })
    await load()
  } catch (e) {
    show(errorText(e), 'error')
    await load()
  } finally {
    const next = new Map(pendingFlags.value)
    next.delete(key)
    pendingFlags.value = next
  }
}
const removingFlag = ref<string | null>(null)
const removeFlagOpen = computed({ get: () => !!removingFlag.value, set: v => !v && (removingFlag.value = null) })
const removeFlagBusy = ref(false)
async function removeFlag() {
  const key = removingFlag.value
  if (!key || removeFlagBusy.value) return
  removeFlagBusy.value = true
  try {
    await useServices().admin.removeFlag(key)
    await load()
    show(t('admin.settings.flags.removed', { key }), 'success')
    removingFlag.value = null
  } catch (e) {
    show(errorText(e), 'error')
  } finally {
    removeFlagBusy.value = false
  }
}
</script>

<template>
  <div class="adm-page">
    <div class="adm-head">
      <div>
        <h1>{{ t('admin.nav.settings') }}</h1>
        <p class="adm-sub">{{ t('admin.settings.sub') }}</p>
      </div>
    </div>
    <AdminListState :loading="!data && !error" :loaded="!!data" :error="error" :empty="false" @retry="load" />

    <template v-if="data">
      <section class="adm-group" aria-labelledby="mode-h">
        <div class="adm-ghead">
          <h2 id="mode-h">{{ t('admin.settings.mode.title') }}</h2>
          <span class="adm-chip adm-end" data-testid="signup-mode">{{ t(`admin.settings.mode.${data.signupMode}`) }}</span>
        </div>
        <div class="adm-panel">
          <UiToggle v-model="openSignup" class="adm-line mode" :label="t('admin.settings.mode.toggle')" :description="t('admin.settings.mode.explain')" :busy="modeBusy" data-testid="signup-toggle" />
        </div>
      </section>

      <section class="adm-group" aria-labelledby="keys-h">
        <div class="adm-ghead stack">
          <h2 id="keys-h">{{ t('admin.settings.keys.title') }}</h2>
          <p class="adm-gsub">{{ t('admin.settings.keys.explain') }}</p>
        </div>
        <div class="adm-panel">
          <div v-for="k in data.aiKeys" :key="k.provider" class="adm-line key" :data-testid="`key-${k.provider}`">
            <span class="prov">
              <ProviderMark :provider="k.provider" :size="22" />
              <span class="adm-lab"><b class="adm-ltr">{{ PROVIDER_NAMES[k.provider] }}</b><small>{{ t(`admin.settings.keys.use.${k.provider}`) }}{{ k.project ? ` · ${k.project}` : '' }}</small></span>
            </span>
            <span class="adm-ctl">
              <span class="state">
                <span class="adm-chip" :class="SOURCE_TONE[k.source]">{{ t(`admin.settings.keys.source.${k.source}`) }}</span>
                <span v-if="k.last4" class="adm-ltr last4">…{{ k.last4 }}</span>
                <span v-if="k.updatedAt" class="adm-muted" :title="utc(k.updatedAt)">{{ dateTime(k.updatedAt, locale) }}</span>
              </span>
              <template v-if="editing !== k.provider">
                <button type="button" class="adm-btn" @click="startKey(k.provider)">{{ k.set ? t('admin.settings.keys.replace') : t('admin.settings.keys.add') }}</button>
                <button v-if="k.source === 'stored'" type="button" class="adm-link danger" @click="removing = k.provider">{{ t('admin.settings.keys.remove') }}</button>
              </template>
            </span>
            <form v-if="editing === k.provider" class="adm-subform" autocomplete="off" @submit.prevent="saveKey(k.provider)">
              <label class="adm-fcol grow"><span class="adm-flab">{{ t('admin.settings.keys.newKey') }}</span>
                <input v-model="keyText" class="adm-input adm-ltr" type="password" autocomplete="new-password" spellcheck="false" minlength="8" maxlength="500" required>
              </label>
              <label v-if="k.provider === 'deepgram'" class="adm-fcol proj"><span class="adm-flab">{{ t('admin.settings.keys.project') }}</span>
                <input v-model="project" class="adm-input adm-ltr" type="text" maxlength="100" autocomplete="off">
              </label>
              <span class="acts">
                <button type="submit" class="adm-btn primary" :disabled="keyText.trim().length < 8 || keyBusy">{{ t('common.save') }}</button>
                <button type="button" class="adm-btn" @click="cancelKey">{{ t('common.cancel') }}</button>
              </span>
              <p v-if="keyError" class="adm-err full" role="alert">{{ keyError }}</p>
            </form>
          </div>
          <p class="adm-foot">{{ t('admin.settings.keys.cleared') }}</p>
        </div>
      </section>

      <section class="adm-group" aria-labelledby="flags-h">
        <div class="adm-ghead">
          <h2 id="flags-h">{{ t('admin.settings.flags.title') }}</h2>
          <span class="adm-gsub">{{ t('admin.settings.flags.explain') }}</span>
        </div>
        <div class="adm-panel">
          <ul v-if="data.flags.length" class="adm-list" :aria-label="t('admin.settings.flags.title')">
            <li v-for="f in data.flags" :key="f.key" class="adm-line">
              <span class="adm-lab"><b class="adm-ltr">{{ f.key }}</b><small v-if="f.description">{{ f.description }}</small></span>
              <span class="adm-ctl">
                <span class="adm-meta">{{ t('admin.settings.flags.changed') }} <span class="nowrap" :title="utc(f.updatedAt)">{{ dateTime(f.updatedAt, locale) }}</span></span>
                <UiToggle :model-value="pendingFlags.get(f.key) ?? f.enabled" :label="f.key" hide-label :busy="pendingFlags.has(f.key)" @update:model-value="toggleFlag(f.key, $event)" />
                <button type="button" class="adm-link danger" :aria-label="`${t('admin.settings.flags.remove')} ${f.key}`" @click="removingFlag = f.key">{{ t('admin.settings.flags.remove') }}</button>
              </span>
            </li>
          </ul>
          <div class="adm-foot stack">
            <form class="adm-addrow add" @submit.prevent="addFlag">
              <label class="adm-fcol"><span class="adm-flab">{{ t('admin.settings.flags.key') }}</span><input v-model="newKey" class="adm-input adm-ltr fkey" placeholder="ai.captions" maxlength="64"></label>
              <label class="adm-fcol grow"><span class="adm-flab">{{ t('admin.settings.flags.description') }}</span><input v-model="newDesc" class="adm-input" dir="auto" maxlength="200"></label>
              <UiToggle v-model="newOn" class="chk" :label="t('admin.settings.flags.on')" size="sm" label-position="end" />
              <button type="submit" class="adm-btn primary" :disabled="addBusy">{{ t('admin.settings.flags.add') }}</button>
            </form>
            <p class="adm-hint" :class="{ 'adm-err': flagError }" role="status">{{ flagError || t('admin.settings.flags.keyRule') }}</p>
          </div>
        </div>
      </section>
    </template>

    <AdminConfirmDialog
      v-model:open="modeOpen"
      :title="nextMode ? t(`admin.settings.mode.confirm.${nextMode}.title`) : ''"
      :text="nextMode ? t(`admin.settings.mode.confirm.${nextMode}.text`) : ''"
      :confirm-label="nextMode ? t(`admin.settings.mode.confirm.${nextMode}.action`) : ''"
      :busy="modeBusy"
      @confirm="setMode"
    />
    <AdminConfirmDialog
      v-model:open="removeOpen"
      :title="t('admin.settings.keys.removeTitle', { provider: removing ?? '' })"
      :text="t('admin.settings.keys.removeText')"
      :confirm-label="t('admin.settings.keys.remove')"
      tone="danger"
      :busy="removeBusy"
      @confirm="removeKey"
    />
    <AdminConfirmDialog
      v-model:open="removeFlagOpen"
      :title="t('admin.settings.flags.removeTitle', { key: removingFlag ?? '' })"
      :text="t('admin.settings.flags.removeText')"
      :confirm-label="t('admin.settings.flags.remove')"
      tone="danger"
      :busy="removeFlagBusy"
      @confirm="removeFlag"
    />
  </div>
</template>

<style scoped>
.prov {
  display: flex;
  align-items: center;
  gap: 12px;
  min-inline-size: 0;
}
.state {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.last4 {
  color: var(--tilw-text-ink);
  font-family: var(--tilw-font-mono);
}
.proj .adm-input {
  inline-size: 200px;
}
.acts {
  display: inline-flex;
  gap: 8px;
}
.full {
  flex-basis: 100%;
}
.fkey {
  inline-size: 200px;
}
.chk {
  align-self: center;
  block-size: 36px;
}
.mode :deep(.label) {
  font: 600 14.5px/1.45 var(--tilw-font-ar);
}
.mode :deep(.desc) {
  max-inline-size: 64ch;
  font: 500 13px/1.6 var(--tilw-font-ar);
}
</style>
