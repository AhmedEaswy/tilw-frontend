<script setup lang="ts">
/**
 * Scripts from an older version (US8, T092): consent (6:68) → choose (6:69) → confirm (6:70 / 6:71).
 * Old scripts are read only after the user agrees, because on a shared computer they may belong to
 * someone else. Adding one saves a new copy to the account; the original stays in this browser.
 */
import type { LegacyScript } from '~/services/types'

definePageMeta({ layout: 'app' })
const { t } = useI18n()
useHead({ title: () => `${t('settings.legacyTitle')} · tilwprompter` })
const auth = useAuthStore()
const scripts = useScriptsStore()
const errorText = useErrorText()
const { show } = useToast()

const step = ref<'consent' | 'choose' | 'confirm'>('consent')
const found = ref<LegacyScript[]>([])
const chosen = ref<LegacyScript | null>(null)
const added = ref(new Set<string>())
const busy = ref(false)
const error = ref('')

async function scan() {
  busy.value = true
  error.value = ''
  try {
    found.value = await useServices().legacy.scan()
    step.value = 'choose'
  } catch (e) {
    error.value = errorText(e)
  } finally {
    busy.value = false
  }
}
function choose(s: LegacyScript) {
  chosen.value = s
  step.value = 'confirm'
}
async function add() {
  const s = chosen.value
  if (!s) return
  busy.value = true
  error.value = ''
  try {
    const created = await scripts.create(s.title, s.body)
    added.value = new Set([...added.value, s.key])
    show(t('settings.legacyAdded', { title: created.title }))
    step.value = 'choose'
  } catch (e) {
    error.value = errorText(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <!-- 6:68 -->
  <TaskCard v-if="step === 'consent'" :kicker="t('settings.legacyKicker')" :title="t('settings.legacyTitle')" :lede="t('settings.legacyConsent')">
    <p class="note">{{ t('settings.legacyNext') }}</p>
    <UiBanner v-if="error" tone="error">{{ error }}</UiBanner>
    <template #actions>
      <UiButton :loading="busy" @click="scan">{{ t('settings.legacyShow') }}</UiButton>
      <UiButton tone="secondary" to="/app/settings">{{ t('common.cancel') }}</UiButton>
    </template>
  </TaskCard>

  <!-- 6:69 -->
  <section v-else-if="step === 'choose'" class="list">
    <h1>{{ t('settings.legacyListTitle') }}</h1>
    <p class="lede">{{ found.length ? t('settings.legacyListLede') : t('settings.legacyNone') }}</p>
    <ul>
      <li v-for="s in found" :key="s.key">
        <UiGlyph class="ic" :name="s.kind === 'draft' ? 'file' : 'video'" :size="22" />
        <span class="txt"><b dir="auto">{{ s.title }}</b><small>{{ s.kind === 'draft' ? t('settings.legacyDraft') : t('settings.legacySaved') }}</small></span>
        <span v-if="added.has(s.key)" class="done">{{ t('settings.legacyDone') }}</span>
        <button v-else type="button" class="pick" @click="choose(s)">{{ t('settings.legacyPick') }}</button>
      </li>
    </ul>
    <UiButton tone="secondary" to="/app/settings" class="back">{{ t('settings.backToSettings') }}</UiButton>
  </section>

  <!-- 6:70 / 6:71 -->
  <TaskCard v-else :kicker="t('settings.legacyKicker')" :title="t('settings.legacyConfirmTitle')" :lede="t('settings.legacyConfirmLede')">
    <div class="pick-card">
      <b dir="auto">{{ chosen?.title }}</b>
      <small dir="ltr">{{ auth.user?.email }}</small>
    </div>
    <UiBanner v-if="error" tone="error">{{ error }}</UiBanner>
    <template #actions>
      <UiButton :loading="busy" @click="add">{{ t('settings.legacyAdd') }}</UiButton>
      <UiButton tone="secondary" @click="step = 'choose'">{{ t('common.back') }}</UiButton>
    </template>
  </TaskCard>
</template>

<style scoped>
.note {
  margin: 0;
  color: var(--tilw-text-muted);
  font: 400 17px/1.5 var(--tilw-font-ar);
}
.list {
  padding-block: 37px 48px;
}
.list h1 {
  margin: 0;
  font: 700 41px/1.36 var(--tilw-font-ar);
}
.list .lede {
  margin: 10px 0 0;
  color: var(--tilw-text-muted);
  font: 400 17px/1.36 var(--tilw-font-ar);
}
ul {
  display: grid;
  gap: 18px;
  margin: 46px 0 0;
  padding: 0;
  list-style: none;
}
li {
  display: flex;
  align-items: center;
  gap: 14px;
  min-block-size: 80px;
  padding-inline: 18px 20px;
  border-radius: 8px;
  background: var(--tilw-surface-white);
}
.ic {
  color: var(--tilw-action-primary);
}
.txt {
  display: grid;
  flex: 1;
  gap: 4px;
}
.txt b {
  font: 500 19px/1.36 var(--tilw-font-ar);
}
.txt small {
  color: var(--tilw-text-muted);
  font: 400 14px/1.36 var(--tilw-font-ar);
}
.pick {
  padding: 6px 0;
  border: 0;
  background: none;
  color: var(--tilw-action-primary);
  font: 500 15px/1.36 var(--tilw-font-ar);
  cursor: pointer;
}
.pick:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
.done {
  color: var(--tilw-status-success);
  font: 500 15px/1.36 var(--tilw-font-ar);
}
.back {
  margin-block-start: 58px;
  min-inline-size: 232px;
}
.pick-card {
  display: grid;
  gap: 6px;
  padding: 14px 18px 18px;
  border-radius: 9px;
  background: var(--tilw-surface-paper);
}
.pick-card b {
  font: 500 18px/1.36 var(--tilw-font-ar);
}
.pick-card small {
  color: var(--tilw-text-muted);
  font: 400 15px/1.36 var(--tilw-font-lat);
  text-align: end;
}
:dir(rtl) .pick-card small {
  text-align: start;
}
@media (max-width: 760px) {
  .list {
    padding-block: 24px;
  }
  .list h1 {
    font-size: 32px;
  }
  ul {
    margin-block-start: 24px;
  }
  .back {
    inline-size: 100%;
  }
}
</style>
