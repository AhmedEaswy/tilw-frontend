<script setup lang="ts">
/** Feature 007 · user detail · Scripts: most recently updated first, with takes and practice counts (never the text). */
import { dateOnly, dateTime, num, utc } from '~/utils/admin'

const props = defineProps<{ userId: string }>()
const { t, locale } = useI18n()
const list = usePagedList(cursor => useServices().admin.userScripts(props.userId, cursor, 25))
onMounted(list.reload)
</script>

<template>
  <section class="adm-card" data-testid="tab-scripts">
    <div class="adm-toolbar"><h2 class="adm-card-title">{{ t('admin.userTabs.scripts.title') }}</h2></div>
    <div v-if="list.items.value.length" class="adm-scroll">
      <table class="adm-tbl">
        <caption>{{ t('admin.userTabs.scripts.title') }}</caption>
        <thead>
          <tr>
            <th scope="col">{{ t('admin.userTabs.scripts.script') }}</th>
            <th scope="col" class="n">{{ t('admin.userTabs.scripts.words') }}</th>
            <th scope="col" class="n">{{ t('admin.userTabs.scripts.takes') }}</th>
            <th scope="col" class="n">{{ t('admin.userTabs.scripts.practice') }}</th>
            <th scope="col">{{ t('admin.userTabs.scripts.opened') }}</th>
            <th scope="col">{{ t('admin.userTabs.scripts.updated') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="x in list.items.value" :key="x.id">
            <td>
              <span class="ttl">
                <b dir="auto">{{ x.title || t('admin.userTabs.scripts.untitled') }}</b>
                <span v-if="x.pinned" class="adm-chip info">{{ t('admin.userTabs.scripts.pinned') }}</span>
                <span v-if="x.archived" class="adm-chip">{{ t('admin.userTabs.scripts.archived') }}</span>
              </span>
            </td>
            <td class="n adm-ltr">{{ num(x.wordCount) }}</td>
            <td class="n adm-ltr">{{ num(x.takes) }}</td>
            <td class="n adm-ltr">{{ num(x.practiceSessions) }}</td>
            <td class="nowrap" :title="utc(x.lastOpenedAt)">{{ x.lastOpenedAt ? dateTime(x.lastOpenedAt, locale) : '—' }}</td>
            <td class="nowrap" :title="utc(x.updatedAt)">{{ dateOnly(x.updatedAt, locale) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <AdminListState
      :loading="list.loading.value" :loaded="list.loaded.value" :error="list.error.value" :empty="!list.items.value.length"
      :done="list.done.value" paged :count="list.items.value.length" :empty-text="t('admin.userTabs.scripts.empty')"
      @retry="list.reload" @more="list.more"
    />
  </section>
</template>

<style scoped>
.ttl {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
</style>
