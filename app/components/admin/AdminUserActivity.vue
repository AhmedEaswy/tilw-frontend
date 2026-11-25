<script setup lang="ts">
/** Feature 007 · user detail · Activity: every admin change to this account (the audit log filtered to them), paged. */
const props = defineProps<{ userId: string }>()
const { t } = useI18n()
const list = usePagedList(cursor => useServices().admin.auditLog({ targetType: 'User', targetId: props.userId }, cursor))
onMounted(list.reload)
</script>

<template>
  <section class="adm-group" data-testid="tab-activity">
    <div class="adm-ghead">
      <h2>{{ t('admin.userTabs.activity.title') }}</h2>
      <NuxtLink class="adm-link adm-end" :to="`/admin/audit?targetType=User&targetId=${encodeURIComponent(userId)}`">{{ t('admin.detail.fullLog') }}</NuxtLink>
    </div>
    <div class="adm-panel">
      <AuditTable v-if="list.items.value.length" :entries="list.items.value" compact />
      <AdminListState
        :loading="list.loading.value" :loaded="list.loaded.value" :error="list.error.value" :empty="!list.items.value.length"
        :done="list.done.value" paged :count="list.items.value.length" :empty-text="t('admin.detail.noActivity')"
        @retry="list.reload" @more="list.more"
      />
    </div>
  </section>
</template>
