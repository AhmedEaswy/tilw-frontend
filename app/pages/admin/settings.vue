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
      <section class="adm-card adm-card-pad" aria-labelledby="mode-h">
        <div class="adm-card-head">
          <h2 id="mode-h">{{ t('admin.settings.mode.title') }}</h2>
          <span class="adm-chip" data-testid="signup-mode">{{ t(`admin.settings.mode.${data.signupMode}`) }}</span>
        </div>
        <UiToggle v-model="openSignup" class="mode" :label="t('admin.settings.mode.toggle')" :busy="modeBusy" data-testid="signup-toggle" />
        <p class="adm-muted">{{ t('admin.settings.mode.explain') }}</p>
      </section>

      <section class="adm-card adm-card-pad" aria-labelledby="keys-h">
        <h2 id="keys-h">{{ t('admin.settings.keys.title') }}</h2>
        <p class="adm-muted">{{ t('admin.settings.keys.explain') }}</p>
        <div v-for="k in data.aiKeys" :key="k.provider" class="key" :data-testid="`key-${k.provider}`">
          <div class="adm-card-head">
            <span class="prov"><ProviderMark :provider="k.provider" :size="22" /><span class="adm-person"><b class="adm-ltr">{{ PROVIDER_NAMES[k.provider] }}</b><small>{{ t(`admin.settings.keys.use.${k.provider}`) }}{{ k.project ? ` · ${k.project}` : '' }}</small></span></span>
            <span class="state">
              <span class="adm-chip" :class="SOURCE_TONE[k.source]">{{ t(`admin.settings.keys.source.${k.source}`) }}</span>
              <span v-if="k.last4" class="adm-ltr">…{{ k.last4 }}</span>
              <span v-if="k.updatedAt" class="adm-muted" :title="utc(k.updatedAt)">{{ dateTime(k.updatedAt, locale) }}</span>
            </span>
          </div>
          <form v-if="editing === k.provider" class="adm-row" autocomplete="off" @submit.prevent="saveKey(k.provider)">
            <label class="adm-label">{{ t('admin.settings.keys.newKey') }}
              <input v-model="keyText" class="adm-input adm-ltr" type="password" autocomplete="new-password" spellcheck="false" minlength="8" maxlength="500" required>
            </label>
            <label v-if="k.provider === 'deepgram'" class="adm-label proj">{{ t('admin.settings.keys.project') }}
              <input v-model="project" class="adm-input adm-ltr" type="text" maxlength="100" autocomplete="off">
            </label>
            <button type="submit" class="adm-btn primary" :disabled="keyText.trim().length < 8 || keyBusy">{{ t('common.save') }}</button>
            <button type="button" class="adm-btn" @click="cancelKey">{{ t('common.cancel') }}</button>
          </form>
          <p v-if="editing === k.provider && keyError" class="adm-err" role="alert">{{ keyError }}</p>
          <div v-if="editing !== k.provider" class="adm-row">
            <button type="button" class="adm-btn" @click="startKey(k.provider)">{{ k.set ? t('admin.settings.keys.replace') : t('admin.settings.keys.add') }}</button>
            <button v-if="k.source === 'stored'" type="button" class="adm-link danger" @click="removing = k.provider">{{ t('admin.settings.keys.remove') }}</button>
          </div>
        </div>
        <p class="adm-hint">{{ t('admin.settings.keys.cleared') }}</p>
      </section>

      <section class="adm-card" aria-labelledby="flags-h">
        <div class="adm-toolbar"><h2 id="flags-h" class="adm-card-title">{{ t('admin.settings.flags.title') }}</h2><span class="adm-grow adm-muted">{{ t('admin.settings.flags.explain') }}</span></div>
        <div v-if="data.flags.length" class="adm-scroll">
          <table class="adm-tbl">
            <caption>{{ t('admin.settings.flags.title') }}</caption>
            <thead><tr><th scope="col">{{ t('admin.settings.flags.key') }}</th><th scope="col">{{ t('admin.settings.flags.changed') }}</th><th scope="col">{{ t('admin.settings.flags.on') }}</th><th scope="col" class="act"><span class="adm-muted">{{ t('admin.list.actions') }}</span></th></tr></thead>
            <tbody>
              <tr v-for="f in data.flags" :key="f.key">
                <td><span class="adm-person"><b class="adm-ltr">{{ f.key }}</b><small>{{ f.description ?? '' }}</small></span></td>
                <td class="nowrap" :title="utc(f.updatedAt)">{{ dateTime(f.updatedAt, locale) }}</td>
                <td><UiToggle :model-value="pendingFlags.get(f.key) ?? f.enabled" :label="f.key" hide-label size="sm" :busy="pendingFlags.has(f.key)" @update:model-value="toggleFlag(f.key, $event)" /></td>
                <td class="act"><button type="button" class="adm-link danger" :aria-label="`${t('admin.settings.flags.remove')} ${f.key}`" @click="removingFlag = f.key">{{ t('admin.settings.flags.remove') }}</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <form class="adm-row add" @submit.prevent="addFlag">
          <label class="adm-label">{{ t('admin.settings.flags.key') }}<input v-model="newKey" class="adm-input adm-ltr" placeholder="ai.captions" maxlength="64"></label>
          <label class="adm-label">{{ t('admin.settings.flags.description') }}<input v-model="newDesc" class="adm-input" dir="auto" maxlength="200"></label>
          <UiToggle v-model="newOn" class="chk" :label="t('admin.settings.flags.on')" size="sm" label-position="end" />
          <button type="submit" class="adm-btn primary" :disabled="addBusy">{{ t('admin.settings.flags.add') }}</button>
        </form>
        <p class="adm-hint pad" :class="{ 'adm-err': flagError }" role="status">{{ flagError || t('admin.settings.flags.keyRule') }}</p>
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
.key {
  display: grid;
  gap: 10px;
  padding-block: 14px;
  border-block-start: 1px solid var(--tilw-hairline);
}
.state {
  display: flex;
  gap: 8px;
  align-items: center;
}
.proj {
  flex: 0 1 220px !important;
}
.add {
  padding: 12px 16px 0;
}
.pad {
  padding: 6px 16px 12px;
}
.chk {
  align-self: center;
}
.mode {
  max-inline-size: 420px;
}
.prov {
  display: flex;
  gap: 10px;
  align-items: center;
}
</style>
