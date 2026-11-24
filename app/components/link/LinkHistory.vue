<script setup lang="ts">
/**
 * Feature 004, US5 (T048, Figma L8 `290:1482`, empty `290:1546`): the owner's phone links, open ones and those ended
 * in the last 30 days, newest first. Each shows the phone, the script, the studio device, whether it is connected or
 * why it ended, and when it was last used. Open links can be ended from here.
 */
import type { PhoneLink } from '~/services/types'

const { t, locale } = useI18n()
const errorText = useErrorText()
const links = ref<PhoneLink[] | null>(null)
const error = ref('')
const ending = ref<string | null>(null)

async function load() {
  try {
    links.value = await useServices().links.list()
    error.value = ''
  } catch (e) {
    error.value = errorText(e)
  }
}
onMounted(load)

async function end(l: PhoneLink) {
  ending.value = l.id
  try {
    await useServices().links.end(l.id)
    // The studio tab hosting it hears link.ended; this tab may be that studio too.
    if (useLinkStore().link?.id === l.id) useLinkStore().reset()
  } catch (e) {
    error.value = errorText(e)
  } finally {
    ending.value = null
    await load()
  }
}

function phone(l: PhoneLink) {
  const r = l.remote
  if (!r) return t('link.history.noPhone')
  return `${r.name} · ${t(`link.kind.${r.kind}`)}`
}
function detail(l: PhoneLink) {
  const parts = [l.scriptTitle ?? t('link.history.noScript'), l.host.label]
  if (l.state === 'ended') parts.push(linkEndText(t, l.endReason))
  else parts.push(l.remote?.connected ? t('link.history.connected') : t('link.history.notConnected'))
  parts.push(relativeTime(l.endedAt ?? l.lastUsedAt, locale.value))
  return parts.join(' · ')
}
</script>

<template>
  <section class="hist" aria-labelledby="links-h" data-link-history>
    <h2 id="links-h">{{ links && !links.length ? t('link.history.emptyTitle') : t('link.history.title') }}</h2>
    <p class="note">{{ links && !links.length ? t('link.history.emptyHint') : t('link.history.lede') }}</p>
    <UiBanner v-if="error" tone="error">{{ error }}</UiBanner>
    <div v-if="!links && !error" aria-busy="true"><UiSkeleton h="72px" r="8px" /></div>
    <ul v-else-if="links?.length" class="list">
      <li v-for="l in links" :key="l.id" class="row" :class="{ ended: l.state === 'ended' }">
        <span class="txt">
          <b dir="auto">{{ phone(l) }}</b>
          <small dir="auto">{{ detail(l) }}</small>
        </span>
        <button v-if="l.state !== 'ended'" type="button" class="link danger" :disabled="ending === l.id" @click="end(l)">
          {{ t('link.history.end') }}
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.hist {
  display: grid;
  gap: 12px;
}
h2 {
  margin: 0;
  font: 500 21px/1.36 var(--tilw-font-ar);
}
.note {
  margin: 0;
  color: var(--tilw-text-muted);
  font: 400 15px/1.5 var(--tilw-font-ar);
}
.list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.row {
  display: flex;
  align-items: center;
  gap: 14px;
  min-block-size: 72px;
  padding: 12px 20px;
  border-radius: 8px;
  background: var(--tilw-surface-white);
}
.txt {
  display: grid;
  flex: 1;
  gap: 2px;
  min-inline-size: 0;
}
.txt b {
  font: 500 17px/1.36 var(--tilw-font-ar);
}
.txt small {
  color: var(--tilw-text-muted);
  font: 400 14px/1.4 var(--tilw-font-ar);
}
.link {
  min-block-size: 44px;
  padding: 0 8px;
  border: 0;
  background: none;
  font: 500 15px/1.36 var(--tilw-font-ar);
  cursor: pointer;
}
.link.danger {
  color: var(--tilw-status-error);
}
.link:focus-visible {
  outline: 2px solid var(--tilw-focus-ring, var(--tilw-action-primary));
  outline-offset: 2px;
}
</style>
