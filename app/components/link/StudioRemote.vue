<script setup lang="ts">
/**
 * Feature 004, US4 (T045, Figma L7 `288:762`): with roles swapped the Tilw app reads, and the studio page shows the
 * same remote controls as the phone, fed by the link store. The page's own reader stays paused meanwhile.
 */
import type { CommandType } from '~/services/types'

const { t } = useI18n()
const link = useLinkStore()
const s = computed(() => link.state)
const live = computed(() => !!s.value?.partnerPresent && s.value.connection === 'connected')
function send(type: CommandType, extra?: { paragraph?: number; wpm?: number }) {
  void link.send(type, extra)
}
</script>

<template>
  <section class="sr-wrap" data-studio-remote>
    <div class="note">
      <p>{{ t('link.appReads') }}</p>
      <UiButton tone="dark" size="sm" @click="link.requestRoles('host')">{{ t('link.readHere') }}</UiButton>
    </div>
    <p v-if="!live" class="offline" role="status">{{ t('link.appOffline') }}</p>
    <RemoteControls
      class="rc"
      :state="s?.appState ?? null"
      :last-result="s?.lastResult ?? null"
      :disabled="!live"
      :previews="s?.link?.previews ?? true"
      @send="send"
    />
  </section>
</template>

<style scoped>
.sr-wrap {
  display: grid;
  align-content: start;
  justify-items: stretch;
  gap: 16px;
  inline-size: min(440px, 100%);
  margin-inline: auto;
  padding: 24px;
  border-radius: 20px;
  background: var(--tilw-stage-surface);
  color: var(--tilw-stage-text);
}
.note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font: 500 15px/1.5 var(--tilw-font-ar);
}
.note p,
.offline {
  margin: 0;
}
.offline {
  color: var(--tilw-stage-cue);
  font: 500 14px/1.5 var(--tilw-font-ar);
}
</style>
