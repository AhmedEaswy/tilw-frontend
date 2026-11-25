<script setup lang="ts">
/**
 * A take's "…" button on the recordings list: the same dropdown as a script row's options (UiMenu).
 *  Play — in the floating mini player · View — the take page ·
 *  and one Drive action for where the take is: Sync (copy to Drive), Withdraw (stop a copy that is waiting,
 *  running or failed) or Unsync (remove the Drive copy, keep the original here; asks first).
 */
import type { TakeMeta } from '~/services/takes'
import type { UiMenuItem } from '~/components/ui/UiMenu.vue'
import { takePlace } from '~/utils/storage'

const props = defineProps<{ take: TakeMeta }>()

const { t } = useI18n()
const player = usePlayerStore()
const takes = useTakesStore()
const uploads = useUploadsStore()
const storage = useStorageStore()
const num = useTakeNumber()
const { show } = useToast()

const place = computed(() => takePlace(props.take, uploads.entries[props.take.id]).place)
const name = computed(() => (props.take.driveOnly ? props.take.scriptTitle : `${props.take.scriptTitle} · ${t('recordings.take', { n: num(props.take.number) })}`))

const items = computed<UiMenuItem[]>(() => {
  const x = props.take
  const list: UiMenuItem[] = []
  if (place.value !== 'unreachable') list.push({ key: 'play', label: t('takeActions.play'), icon: 'play' })
  list.push({ key: 'view', label: t('takeActions.view'), icon: 'expand' })
  if (place.value === 'device' && storage.linked && storage.syncMode !== 'off') list.push({ key: 'sync', label: t('takeActions.sync'), icon: 'up' })
  if (!x.driveOnly && ['waiting', 'uploading', 'failed'].includes(place.value) && uploads.entries[x.id]) list.push({ key: 'withdraw', label: t('takeActions.withdraw'), icon: 'stop' })
  if (!x.driveOnly && place.value === 'drive') list.push({ key: 'unsync', label: t('takeActions.unsync'), icon: 'close', tone: 'danger' })
  return list
})

const confirming = ref(false)
const busy = ref(false)

function onSelect(key: string) {
  const id = props.take.id
  switch (key) {
    case 'play':
      void player.play(props.take)
      break
    case 'view':
      void navigateTo(`/app/recordings/${id}`)
      break
    case 'sync':
      void uploads.enqueue(id)
      show(t('takeActions.syncStarted'))
      break
    case 'withdraw':
      void uploads.cancel(id)
      show(t('takeActions.withdrawn'))
      break
    case 'unsync':
      confirming.value = true
      break
  }
}

async function unsync() {
  if (busy.value) return
  busy.value = true
  try {
    await takes.unsync(props.take.id)
    show(t('takeActions.unsynced'))
    confirming.value = false
  } catch {
    show(t('recordings.actionFailed'), 'error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <span class="take-actions">
  <UiMenu
    class="take-menu"
    trigger-class="more"
    :items="items"
    :label="t('library.actionsFor', { title: name })"
    data-testid="take-more"
    @select="onSelect"
  />
  <UiDialog v-if="confirming" v-model:open="confirming" :title="t('takeActions.unsyncTitle')">
    <p class="lede">{{ t('takeActions.unsyncLede') }}</p>
    <template #actions>
      <UiButton tone="danger" :loading="busy" data-testid="take-unsync-confirm" @click="unsync">{{ t('takeActions.unsync') }}</UiButton>
      <UiButton tone="secondary" :disabled="busy" @click="confirming = false">{{ t('library.back') }}</UiButton>
    </template>
  </UiDialog>
  </span>
</template>

<style scoped>
.take-actions {
  display: inline-flex;
}
/* The open list sits above the neighbouring cards. */
.take-actions:has(.ui-menu.open) {
  z-index: 30;
}
.take-menu :deep(.more) {
  display: grid;
  place-items: center;
  inline-size: var(--tilw-hit);
  block-size: var(--tilw-hit);
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: none;
  color: inherit;
  cursor: pointer;
}
.take-menu :deep(.more:hover),
.take-menu :deep(.more[aria-expanded='true']) {
  background: color-mix(in srgb, currentColor 12%, transparent);
}
.take-menu :deep(.more:focus-visible) {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
.lede {
  margin: 0;
  color: var(--tilw-text-muted);
  font: 400 17px/1.5 var(--tilw-font-ar);
}
</style>
