<script setup lang="ts">
/** Feature 007 · user detail · Recordings: the person's take records, newest first (metadata only, never media). */
import type { AdminTake } from '~/services/types'
import { dateTime, utc } from '~/utils/admin'
import { formatDuration } from '~/utils/mime'

const props = defineProps<{ userId: string }>()
const { t, locale } = useI18n()
const list = usePagedList(cursor => useServices().admin.userTakes(props.userId, cursor, 25))
onMounted(list.reload)
const tone = (s: AdminTake['state']) => (s === 'backed_up' ? 'success' : s === 'uploading' ? 'info' : 'error')
</script>

<template>
  <section class="adm-card" data-testid="tab-takes">
    <div class="adm-toolbar"><h2 class="adm-card-title">{{ t('admin.userTabs.takes.title') }}</h2></div>
    <div v-if="list.items.value.length" class="adm-scroll">
      <table class="adm-tbl">
        <caption>{{ t('admin.userTabs.takes.title') }}</caption>
        <thead>
          <tr>
            <th scope="col">{{ t('admin.userTabs.takes.take') }}</th>
            <th scope="col">{{ t('admin.userTabs.takes.kind') }}</th>
            <th scope="col" class="n">{{ t('admin.userTabs.takes.length') }}</th>
            <th scope="col" class="n">{{ t('admin.userTabs.takes.size') }}</th>
            <th scope="col">{{ t('admin.userTabs.takes.recorded') }}</th>
            <th scope="col">{{ t('admin.userTabs.takes.state') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="x in list.items.value" :key="x.id">
            <td>
              <span class="adm-person">
                <b>{{ x.title }}<span v-if="x.starred" class="star" :title="t('admin.userTabs.takes.starred')"> ★</span></b>
                <small>{{ x.scriptTitle ?? t('admin.userTabs.takes.noScript') }}</small>
              </span>
            </td>
            <td>{{ t(`admin.userTabs.takes.${x.kind}`) }}</td>
            <td class="n adm-ltr">{{ formatDuration(x.durationMs) }}</td>
            <td class="n adm-ltr">{{ formatBytes(x.sizeBytes, locale) }}</td>
            <td class="nowrap" :title="utc(x.recordedAt)">{{ dateTime(x.recordedAt, locale) }}</td>
            <td><span class="adm-chip" :class="tone(x.state)">{{ t(`admin.userTabs.takes.st.${x.state}`) }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    <AdminListState
      :loading="list.loading.value" :loaded="list.loaded.value" :error="list.error.value" :empty="!list.items.value.length"
      :done="list.done.value" paged :count="list.items.value.length" :empty-text="t('admin.userTabs.takes.empty')"
      @retry="list.reload" @more="list.more"
    />
  </section>
</template>

<style scoped>
.star {
  color: var(--tilw-action-primary);
}
</style>
