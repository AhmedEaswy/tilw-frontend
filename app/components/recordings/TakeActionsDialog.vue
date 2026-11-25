<script setup lang="ts">
/**
 * A take's actions, opened from its "…" button on the recordings page. Same sheet as the script actions (6:108):
 * a dialog on desktop, a bottom sheet on phones, one row per action.
 *  Play — in the floating mini player · View — the take page ·
 *  and one Drive action for where the take is: Sync (copy to Drive), Withdraw (stop a copy that is waiting,
 *  running or failed) or Unsync (remove the Drive copy, keep the original here; asks first).
 */
import type { TakeMeta } from '~/services/takes'
import { takePlace } from '~/utils/storage'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ take: TakeMeta | null }>()

const { t } = useI18n()
const player = usePlayerStore()
const takes = useTakesStore()
const uploads = useUploadsStore()
const storage = useStorageStore()
const num = useTakeNumber()
const { show } = useToast()

const confirming = ref(false)
const busy = ref(false)
watch(open, () => {
  confirming.value = false
  busy.value = false
})

const place = computed(() => (props.take ? takePlace(props.take, uploads.entries[props.take.id]).place : 'device'))
const playable = computed(() => place.value !== 'unreachable')
const canSync = computed(() => place.value === 'device' && storage.linked && storage.syncMode !== 'off')
const canWithdraw = computed(() => !props.take?.driveOnly && ['waiting', 'uploading', 'failed'].includes(place.value) && !!uploads.entries[props.take!.id])
const canUnsync = computed(() => !props.take?.driveOnly && place.value === 'drive')

const title = computed(() => {
  const x = props.take
  if (!x) return ''
  if (confirming.value) return t('takeActions.unsyncTitle')
  return x.driveOnly ? x.scriptTitle : `${x.scriptTitle} · ${t('recordings.take', { n: num(x.number) })}`
})

function play() {
  if (!props.take) return
  void player.play(props.take)
  open.value = false
}
function view() {
  if (!props.take) return
  open.value = false
  void navigateTo(`/app/recordings/${props.take.id}`)
}
function sync() {
  if (!props.take) return
  void uploads.enqueue(props.take.id)
  show(t('takeActions.syncStarted'))
  open.value = false
}
function withdraw() {
  if (!props.take) return
  void uploads.cancel(props.take.id)
  show(t('takeActions.withdrawn'))
  open.value = false
}
async function unsync() {
  if (!props.take || busy.value) return
  busy.value = true
  try {
    await takes.unsync(props.take.id)
    show(t('takeActions.unsynced'))
    open.value = false
  } catch {
    show(t('recordings.actionFailed'), 'error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiDialog v-model:open="open" :title="title">
    <p v-if="take && confirming" class="lede">{{ t('takeActions.unsyncLede') }}</p>

    <ul v-else-if="take" class="acts" data-testid="take-actions">
      <li v-if="playable">
        <button type="button" @click="play"><UiGlyph name="play" :size="20" />{{ t('takeActions.play') }}<UiGlyph class="go" name="arr" :size="16" /></button>
      </li>
      <li>
        <button type="button" @click="view"><UiGlyph name="expand" :size="20" />{{ t('takeActions.view') }}<UiGlyph class="go" name="arr" :size="16" /></button>
      </li>
      <li v-if="canSync">
        <button type="button" @click="sync"><UiGlyph name="up" :size="20" />{{ t('takeActions.sync') }}<UiGlyph class="go" name="arr" :size="16" /></button>
      </li>
      <li v-if="canWithdraw">
        <button type="button" @click="withdraw"><UiGlyph name="stop" :size="20" />{{ t('takeActions.withdraw') }}<UiGlyph class="go" name="arr" :size="16" /></button>
      </li>
      <li v-if="canUnsync">
        <button type="button" class="danger" @click="confirming = true"><UiGlyph name="close" :size="20" />{{ t('takeActions.unsync') }}<UiGlyph class="go" name="arr" :size="16" /></button>
      </li>
    </ul>

    <template v-if="take && confirming" #actions>
      <UiButton tone="danger" :loading="busy" data-testid="take-unsync-confirm" @click="unsync">{{ t('takeActions.unsync') }}</UiButton>
      <UiButton tone="secondary" :disabled="busy" @click="confirming = false">{{ t('library.back') }}</UiButton>
    </template>
  </UiDialog>
</template>

<style scoped>
/* Same rows as the script actions sheet (LibraryDialogs 6:108). */
.acts {
  display: grid;
  gap: 15px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.acts button {
  display: flex;
  align-items: center;
  gap: 10px;
  inline-size: 100%;
  min-block-size: 51px;
  padding-inline: 20px 14px;
  border: 0;
  border-radius: 9px;
  background: var(--tilw-surface-white);
  color: var(--tilw-text-ink);
  font: 500 17px/1.36 var(--tilw-font-ar);
  text-align: start;
  cursor: pointer;
}
.acts button:hover {
  background: var(--tilw-surface-quiet);
}
.acts button:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
.acts button.danger {
  color: var(--tilw-status-error);
}
.acts .go {
  margin-inline-start: auto;
  color: var(--tilw-action-primary);
}
.lede {
  margin: 0;
  color: var(--tilw-text-muted);
  font: 400 17px/1.5 var(--tilw-font-ar);
}
</style>
