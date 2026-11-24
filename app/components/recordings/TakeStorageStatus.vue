<script setup lang="ts">
/**
 * Where a take is (R2-7 `262:1018`, release-1 "Storage status" component 5:180 variants): On this device · Waiting to
 * upload · Uploading N% · In Google Drive · In Drive only · Backup failed · reason (with Retry) · Not reachable.
 * Drive states carry the Drive mark; uploading draws a progress ring around it (and, with `detailed`, a bar with the
 * bytes sent). With linked storage and sync on, a device-only take offers "نسخ إلى Drive". A failure never touches
 * the device copy.
 */
import type { TakeMeta } from '~/services/takes'
import { takePlace } from '~/utils/storage'

const props = defineProps<{ take: TakeMeta; actions?: boolean; detailed?: boolean }>()
const { t, locale } = useI18n()
const uploads = useUploadsStore()
const storage = useStorageStore()

const entry = computed(() => uploads.entries[props.take.id])
const info = computed(() => takePlace(props.take, entry.value))
const place = computed(() => info.value.place)
const percent = computed(() => info.value.percent ?? 0)

const label = computed(() => {
  if (place.value === 'uploading') return t('uploads.uploading', { n: percent.value })
  return t(`uploads.place.${place.value}`)
})
const note = computed(() => {
  const i = info.value
  if (i.error && (i.place === 'failed' || i.place === 'waiting')) return t(`uploads.reason.${i.error}`)
  if (i.place === 'uploading' && props.detailed && entry.value?.total) {
    return t('uploads.bytes', { sent: formatBytes(entry.value.sent, locale.value), total: formatBytes(entry.value.total, locale.value) })
  }
  return ''
})
const tone = computed(() => {
  switch (place.value) {
    case 'drive':
    case 'driveOnly': return 'ok'
    case 'failed':
    case 'unreachable': return 'bad'
    case 'waiting':
    case 'uploading': return 'busy'
    default: return 'plain'
  }
})

/** Ring around the mark: r = 14.5 in a 32 box. */
const CIRC = 2 * Math.PI * 14.5
const dash = computed(() => `${(CIRC * percent.value) / 100} ${CIRC}`)

const canCopy = computed(() => props.actions && place.value === 'device' && storage.linked && storage.syncMode !== 'off')
const fixLink = computed(() => {
  const e = info.value.error
  if (e === 'storage_full') return { to: '/app/settings/storage#space', text: t('uploads.seeSpace') }
  if (e === 'storage_not_linked') return { to: '/app/settings/storage', text: t('uploads.openStorage') }
  return null
})
const driveUrl = computed(() => {
  const id = props.take.remote?.providerFileId
  return id && (place.value === 'drive' || place.value === 'driveOnly') ? `https://drive.google.com/file/d/${encodeURIComponent(id)}/view` : null
})
</script>

<template>
  <div class="tss" :class="[tone, { detailed }]">
    <span class="mark" :class="place">
      <svg v-if="tone === 'busy'" class="ring" viewBox="0 0 32 32" aria-hidden="true">
        <circle class="track" cx="16" cy="16" r="14.5" />
        <circle v-if="place === 'uploading'" class="fill" cx="16" cy="16" r="14.5" :stroke-dasharray="dash" />
      </svg>
      <UiGlyph v-if="place === 'device'" name="file" :size="15" />
      <DriveMark v-else :size="15" :mono="tone === 'bad'" />
      <span v-if="tone === 'ok'" class="dot ok" aria-hidden="true"><UiGlyph name="check" :size="9" /></span>
      <span v-else-if="tone === 'bad'" class="dot bad" aria-hidden="true">!</span>
    </span>

    <span class="txt" role="status">
      <b>{{ label }}</b>
      <small v-if="note">{{ note }}</small>
    </span>

    <span v-if="actions" class="acts">
      <button v-if="canCopy" type="button" class="act" @click="uploads.enqueue(take.id)">
        <DriveMark :size="13" />{{ t('uploads.copy') }}
      </button>
      <button v-if="place === 'failed' && !take.driveOnly" type="button" class="act" @click="uploads.retry(take.id)">{{ t('common.retry') }}</button>
      <NuxtLink v-if="place === 'failed' && fixLink" :to="fixLink.to" class="act">{{ fixLink.text }}</NuxtLink>
      <a v-if="driveUrl" :href="driveUrl" target="_blank" rel="noopener" class="act quiet">{{ t('uploads.openInDrive') }}</a>
    </span>

    <span v-if="detailed && place === 'uploading'" class="bar" aria-hidden="true"><i :style="{ inlineSize: `${percent}%` }" /></span>
  </div>
</template>

<style scoped>
.tss {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  color: var(--tilw-text-muted);
}

/* The mark: a 32px disc holding the glyph or the Drive logo, a ring while busy, a badge when settled. */
.mark {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  inline-size: 32px;
  block-size: 32px;
  border-radius: 50%;
  background: var(--tilw-surface-white);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tilw-text-ink) 10%, transparent);
  color: var(--tilw-text-muted);
}
.busy .mark,
.bad .mark {
  box-shadow: none;
}
.bad .mark {
  background: color-mix(in srgb, var(--tilw-status-error) 10%, var(--tilw-surface-white));
  color: var(--tilw-status-error);
}
.ring {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  transform: rotate(-90deg);
}
.ring circle {
  fill: none;
  stroke-width: 2.5;
}
.ring .track {
  stroke: color-mix(in srgb, var(--tilw-action-primary) 18%, transparent);
}
.waiting .ring .track {
  stroke: var(--tilw-action-primary);
  stroke-dasharray: 4 5;
  animation: tss-spin 6s linear infinite;
  transform-origin: center;
}
.ring .fill {
  stroke: var(--tilw-action-primary);
  stroke-linecap: round;
  transition: stroke-dasharray 0.35s ease;
}
.dot {
  position: absolute;
  inset-block-end: -2px;
  inset-inline-end: -3px;
  display: grid;
  place-items: center;
  inline-size: 14px;
  block-size: 14px;
  border: 2px solid var(--tilw-surface-paper);
  border-radius: 50%;
  color: var(--tilw-text-on-solid);
  font: 700 9px/1 var(--tilw-font-lat);
}
.dot.ok {
  background: var(--tilw-status-success);
}
.dot.bad {
  background: var(--tilw-status-error);
}

.txt {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 8px;
  min-inline-size: 0;
}
.txt b {
  color: var(--tilw-text-ink);
  font: 500 14px/1.36 var(--tilw-font-ar);
}
.ok .txt b {
  color: var(--tilw-status-success);
}
.busy .txt b {
  color: var(--tilw-action-primary);
  font-variant-numeric: tabular-nums;
}
.bad .txt b {
  color: var(--tilw-status-error);
}
.txt small {
  color: var(--tilw-text-muted);
  font: 400 13px/1.36 var(--tilw-font-ar);
}

.acts {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
  margin-inline-start: 4px;
}
.act {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-block-size: 32px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--tilw-action-primary) 35%, transparent);
  border-radius: var(--tilw-radius-pill);
  background: none;
  color: var(--tilw-action-primary);
  font: 500 14px/1.36 var(--tilw-font-ar);
  text-decoration: none;
  cursor: pointer;
}
.act:hover {
  background: var(--tilw-surface-selected);
}
.act.quiet {
  padding-inline: 2px;
  border-color: transparent;
}
.act.quiet:hover {
  background: none;
  text-decoration: underline;
}
.act:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 2px;
}

.bar {
  flex-basis: 100%;
  block-size: 4px;
  overflow: hidden;
  border-radius: 2px;
  background: color-mix(in srgb, var(--tilw-action-primary) 16%, transparent);
}
.bar i {
  display: block;
  block-size: 100%;
  border-radius: inherit;
  background: var(--tilw-action-primary);
  transition: inline-size 0.35s ease;
}

@keyframes tss-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .waiting .ring .track {
    animation: none;
  }
  .ring .fill,
  .bar i {
    transition: none;
  }
}
</style>
