<script setup lang="ts">
/**
 * Google Drive link (R2-6 `254:501` not linked, `254:564` linked). Before linking it says in plain words what Tilw can
 * see: only the files it creates. Unlinking is one confirmed action.
 */
import type { StorageStatus } from '~/services/types'

const props = defineProps<{ status: StorageStatus | null; busy?: boolean }>()
const emit = defineEmits<{ link: []; unlink: [] }>()
const { t } = useI18n()
const confirming = ref(false)

const state = computed(() => props.status?.state ?? 'none')
</script>

<template>
  <section class="link" aria-labelledby="link-h">
    <div class="head">
      <span class="logo" :class="state" aria-hidden="true">
        <DriveMark :size="30" />
        <span v-if="state === 'linked'" class="dot ok"><UiGlyph name="check" :size="11" /></span>
        <span v-else-if="state === 'revoked'" class="dot bad">!</span>
      </span>
      <div>
        <h2 id="link-h">{{ t('storage.drive') }}</h2>
        <p v-if="state === 'linked'" class="who">{{ t('storage.linkedAs') }} <b dir="ltr">{{ status?.accountEmail }}</b></p>
        <p v-else-if="state === 'revoked'" class="who warn">{{ t('storage.revoked') }}</p>
        <p v-else class="who">{{ t('storage.notLinked') }}</p>
      </div>
    </div>

    <ul class="facts">
      <li>{{ t('storage.factOnlyOwn') }}</li>
      <li>{{ t('storage.factDirect') }}</li>
      <li>{{ t('storage.factDevice') }}</li>
    </ul>

    <div class="acts">
      <UiButton v-if="state !== 'linked'" :loading="busy" @click="emit('link')">{{ state === 'revoked' ? t('storage.relink') : t('storage.link') }}</UiButton>
      <button v-else type="button" class="unlink" @click="confirming = true">{{ t('storage.unlink') }}</button>
      <button v-if="state === 'revoked'" type="button" class="unlink" @click="confirming = true">{{ t('storage.unlink') }}</button>
    </div>

    <UiDialog v-model:open="confirming" :title="t('storage.unlinkTitle')">
      <p>{{ t('storage.unlinkLede') }}</p>
      <p>{{ t('storage.unlinkStays') }}</p>
      <template #actions>
        <UiButton tone="danger" :loading="busy" @click="emit('unlink'); confirming = false">{{ t('storage.unlinkConfirm') }}</UiButton>
        <UiButton tone="secondary" @click="confirming = false">{{ t('library.back') }}</UiButton>
      </template>
    </UiDialog>
  </section>
</template>

<style scoped>
.link {
  display: grid;
  align-content: start;
  gap: 18px;
  padding: 24px 27px;
  border-radius: 12px;
  background: var(--tilw-surface-white);
}
.head {
  display: flex;
  align-items: center;
  gap: 14px;
}
.logo {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  inline-size: 56px;
  block-size: 56px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 1px 2px color-mix(in srgb, var(--tilw-text-ink) 14%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--tilw-text-ink) 8%, transparent);
}
.logo.none {
  filter: saturate(0.85);
}
.dot {
  position: absolute;
  inset-block-end: -5px;
  inset-inline-end: -5px;
  display: grid;
  place-items: center;
  inline-size: 20px;
  block-size: 20px;
  border: 2px solid var(--tilw-surface-white);
  border-radius: 50%;
  color: var(--tilw-text-on-solid);
  font: 700 12px/1 var(--tilw-font-lat);
}
.dot.ok {
  background: var(--tilw-status-success);
}
.dot.bad {
  background: var(--tilw-status-error);
}
h2 {
  margin: 0;
  font: 500 21px/1.36 var(--tilw-font-ar);
}
.who {
  margin: 2px 0 0;
  color: var(--tilw-text-muted);
  font: 400 16px/1.36 var(--tilw-font-ar);
}
.who b {
  color: var(--tilw-text-ink);
  font-family: var(--tilw-font-lat);
  font-weight: 500;
}
.who.warn {
  color: var(--tilw-status-error);
}
.facts {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-inline-start: 20px;
  color: var(--tilw-text-muted);
  font: 400 15px/1.5 var(--tilw-font-ar);
}
.acts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}
.unlink {
  padding: 4px;
  border: 0;
  background: none;
  color: var(--tilw-status-error);
  font: 500 16px/1.36 var(--tilw-font-ar);
  cursor: pointer;
}
.unlink:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}
@media (max-width: 760px) {
  .link {
    padding: 18px;
  }
}
</style>
