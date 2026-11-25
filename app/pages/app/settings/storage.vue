<script setup lang="ts">
/**
 * Storage (R2-6 `254:501` not linked, `254:564` linked). Link Google Drive through Google's own consent page, choose
 * Off / Manual / Auto (Auto gated by plan), see Drive and Tilw space. The consent page sends the person back here with
 * `?linked=1` or `?error=denied|failed`; that message shows once, then the URL is cleaned.
 */
import type { SyncMode } from '~/services/types'

definePageMeta({ layout: 'app' })
const { t } = useI18n()
useHead({ title: () => `${t('storage.title')} · tilwprompter` })
const storage = useStorageStore()
const upgrade = useUpgrade()
const limitError = useLimitError()
const errorText = useErrorText()
const { show } = useToast()
const route = useRoute()
const router = useRouter()

const busy = ref(false)
const back = ref<'denied' | 'failed' | null>(null)

onMounted(async () => {
  const { linked, error } = route.query
  if (linked || error) {
    back.value = error === 'denied' ? 'denied' : error ? 'failed' : null
    await router.replace({ query: {} })
  }
  try {
    await storage.load()
    if (linked && storage.linked) show(t('storage.linkedToast', { email: storage.status?.accountEmail ?? '' }))
  } catch { /* shown below */ }
})

async function link() {
  busy.value = true
  try {
    await storage.connect()
  } catch (e) {
    if (!limitError.handle(e)) show(errorText(e), 'error')
    busy.value = false
  }
}

async function unlink() {
  busy.value = true
  try {
    await storage.unlink()
    void useTakesStore().loadRemote().catch(() => {})
    show(t('storage.unlinked'))
  } catch (e) {
    show(errorText(e), 'error')
  } finally {
    busy.value = false
  }
}

async function setMode(m: SyncMode) {
  try {
    await storage.setSyncMode(m)
    show(t('storage.modeSaved', { mode: t(`storage.mode.${m}`) }))
  } catch (e) {
    if (!limitError.handle(e)) show(errorText(e, { storage_not_linked: t('storage.linkFirst') }), 'error')
  }
}
</script>

<template>
  <div class="stor">
    <NuxtLink to="/app/settings" class="back">{{ t('settings.backToSettings') }}</NuxtLink>
    <h1>{{ t('storage.title') }}</h1>
    <p class="lede">{{ t('storage.lede') }}</p>

    <UiBanner v-if="back === 'denied'" tone="warning" class="msg">{{ t('storage.denied') }}</UiBanner>
    <UiBanner v-else-if="back === 'failed'" tone="error" class="msg">{{ t('storage.linkFailed') }}</UiBanner>

    <!-- Loading: the Drive card (logo, name, facts, button) beside the sync choices. -->
    <SkeletonRegion v-if="!storage.status && (storage.loading || !storage.error)" class="grid" data-testid="storage-skeleton">
      <SkeletonCard icon="56px" title="26px" title-w="40%" :lines="3" line-h="15px" :actions="1" padding="24px 27px" gap="18px" />
      <div class="side" aria-hidden="true">
        <section class="sync-skel">
          <UiSkeleton h="28px" w="45%" />
          <SkeletonRows :count="3" height="72px" lead="circle" lead-size="20px" title-h="17px" />
        </section>
      </div>
    </SkeletonRegion>
    <UiBanner v-else-if="!storage.status" tone="error" class="msg">
      {{ errorText(storage.error) }}
      <template #action><UiButton size="sm" tone="secondary" @click="storage.load().catch(() => {})">{{ t('common.retry') }}</UiButton></template>
    </UiBanner>

    <div v-else class="grid">
      <LinkCard :status="storage.status" :busy="busy" @link="link" @unlink="unlink" />
      <div class="side">
        <SyncModeControl
          :mode="storage.syncMode"
          :auto-allowed="storage.status.autoSyncAllowed"
          :disabled="!storage.linked"
          @change="setMode"
          @locked="upgrade.open()"
        />
        <SpaceMeters v-if="storage.linked && storage.status.quota" :quota="storage.status.quota" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.stor {
  padding-block: 30px 48px;
}
.back {
  color: var(--tilw-action-primary);
  font: 500 16px/1.36 var(--tilw-font-ar);
}
h1 {
  margin: 16px 0 0;
  font: 700 41px/1.36 var(--tilw-font-ar);
}
.lede {
  margin: 8px 0 0;
  color: var(--tilw-text-muted);
  font: 400 17px/1.5 var(--tilw-font-ar);
}
.msg {
  margin-block-start: 22px;
}
.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 22px;
  margin-block-start: 30px;
  align-items: start;
}
.side {
  display: grid;
  gap: 28px;
}
.sync-skel {
  display: grid;
  gap: 14px;
}
@media (max-width: 860px) {
  .stor {
    padding-block: 20px;
  }
  h1 {
    font-size: 32px;
  }
  .grid {
    grid-template-columns: 1fr;
    gap: 22px;
    margin-block-start: 18px;
  }
}
</style>
