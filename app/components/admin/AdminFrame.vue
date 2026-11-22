<script setup lang="ts">
/**
 * Frame for the admin pages (waitlist, invitations): title with the invite action, the two page tabs with counts,
 * and the invite dialog. The lists themselves load once into the admin store.
 */
const { t } = useI18n()
const route = useRoute()
const admin = useAdminStore()
const inviting = ref(false)

onMounted(() => {
  if (admin.waitlist === null && !admin.loading) void admin.load()
})

const tabs = computed(() => [
  { to: '/app/admin', label: t('admin.tabWaitlist'), count: admin.waitingCount },
  { to: '/app/admin/invitations', label: t('admin.tabInvitations'), count: admin.pendingCount },
])
const isCurrent = (to: string) => (to === '/app/admin' ? route.path.replace(/\/$/, '') === to : route.path.startsWith(to))
</script>

<template>
  <div class="adm">
    <div class="top">
      <h1>{{ t('admin.title') }}</h1>
      <UiButton icon="plus" @click="inviting = true">{{ t('admin.inviteButton') }}</UiButton>
    </div>

    <nav class="sub" :aria-label="t('admin.title')">
      <NuxtLink v-for="tab in tabs" :key="tab.to" :to="tab.to" :aria-current="isCurrent(tab.to) ? 'page' : undefined">
        {{ tab.label }}<span class="cnt">{{ tab.count }}</span>
      </NuxtLink>
    </nav>

    <slot />

    <InviteDialog v-model:open="inviting" />
  </div>
</template>

<style scoped>
.adm {
  max-inline-size: var(--tilw-content-max);
  margin-inline: auto;
  padding: var(--tilw-space-32) var(--tilw-space-24) var(--tilw-space-48);
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tilw-space-16);
  margin-block-end: var(--tilw-space-24);
}
h1 {
  font: var(--tilw-type-title);
}
.sub {
  display: flex;
  gap: var(--tilw-space-32);
  border-block-end: 1px solid var(--tilw-border-subtle);
  margin-block-end: var(--tilw-space-24);
}
.sub a {
  display: flex;
  align-items: center;
  gap: var(--tilw-space-8);
  padding-block: var(--tilw-space-12);
  margin-block-end: -1px;
  border-block-end: 3px solid transparent;
  font: var(--tilw-type-control);
  color: var(--tilw-text-muted);
  text-decoration: none;
}
.sub a[aria-current='page'] {
  color: var(--tilw-text-ink);
  border-color: var(--tilw-action-primary);
}
.cnt {
  min-inline-size: 26px;
  padding-inline: 10px;
  border-radius: var(--tilw-radius-pill);
  background: var(--tilw-surface-quiet);
  color: var(--tilw-text-muted);
  font: var(--tilw-type-meta);
  text-align: center;
}
.sub a[aria-current='page'] .cnt {
  background: var(--tilw-surface-selected);
  color: var(--tilw-action-primary);
}
@media (max-width: 720px) {
  h1 {
    font: var(--tilw-type-heading);
  }
}
</style>
