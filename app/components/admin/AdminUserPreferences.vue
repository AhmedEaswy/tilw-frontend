<script setup lang="ts">
/** Feature 007 · user detail · Settings: the person's language, theme, sync mode and reading settings, read-only. */
import type { AdminPreferences } from '~/services/types'

const props = defineProps<{ userId: string }>()
const { t, te } = useI18n()
const errorText = useErrorText()
const data = ref<AdminPreferences | null>(null)
const error = ref<unknown>(null)
async function load() {
  error.value = null
  try {
    data.value = await useServices().admin.userPreferences(props.userId)
  } catch (e) {
    error.value = e
  }
}
onMounted(load)

const KNOWN = ['mode', 'wpm', 'fontSize', 'mirror', 'lineWidth', 'countdownSec'] as const
const reading = computed(() => {
  const r = (data.value?.reading ?? {}) as Record<string, unknown>
  const keys = [...KNOWN.filter(k => k in r), ...Object.keys(r).filter(k => !(KNOWN as readonly string[]).includes(k))]
  return keys.map(k => ({ key: k, label: te(`admin.userTabs.prefs.reading.${k}`) ? t(`admin.userTabs.prefs.reading.${k}`) : k, value: show(k, r[k]) }))
})
function show(key: string, v: unknown): string {
  if (typeof v === 'boolean') return v ? t('admin.userTabs.prefs.on') : t('admin.userTabs.prefs.off')
  if (key === 'countdownSec' && typeof v === 'number') return v ? t('admin.userTabs.prefs.seconds', { n: v }) : t('admin.userTabs.prefs.off')
  if (key === 'wpm' && typeof v === 'number') return t('admin.userTabs.prefs.wpm', { n: v })
  if (typeof v === 'string' && te(`admin.userTabs.prefs.value.${v}`)) return t(`admin.userTabs.prefs.value.${v}`)
  return v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)
}
</script>

<template>
  <div data-testid="tab-settings">
    <div v-if="error" class="adm-note error" role="alert">
      {{ errorText(error) }} <button type="button" class="adm-link" @click="load">{{ t('common.retry') }}</button>
    </div>
    <UiSkeleton v-else-if="!data" h="200px" />
    <div v-else class="cols">
      <section class="adm-card adm-card-pad">
        <h2>{{ t('admin.userTabs.prefs.general') }}</h2>
        <dl class="adm-kv">
          <div><dt>{{ t('admin.userTabs.prefs.locale') }}</dt><dd>{{ data.locale === 'ar' ? 'العربية' : 'English' }}</dd></div>
          <div><dt>{{ t('admin.userTabs.prefs.theme') }}</dt><dd>{{ t(`admin.userTabs.prefs.themes.${data.theme}`) }}</dd></div>
          <div><dt>{{ t('admin.userTabs.prefs.sync') }}</dt><dd>{{ t(`admin.userTabs.prefs.syncModes.${data.syncMode}`) }}</dd></div>
        </dl>
      </section>
      <section class="adm-card adm-card-pad">
        <h2>{{ t('admin.userTabs.prefs.readingTitle') }}</h2>
        <dl class="adm-kv">
          <div v-for="r in reading" :key="r.key"><dt>{{ r.label }}</dt><dd class="adm-ltr">{{ r.value }}</dd></div>
        </dl>
      </section>
    </div>
    <p class="adm-muted ro">{{ t('admin.userTabs.prefs.readOnly') }}</p>
  </div>
</template>

<style scoped>
.cols {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  align-items: start;
}
.ro {
  margin-block-start: 10px;
  font-size: 12.5px;
}
</style>
