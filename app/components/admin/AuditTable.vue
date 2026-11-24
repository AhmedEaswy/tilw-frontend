<script setup lang="ts">
/**
 * Feature 006 (D9 `313:1849`): audit entries with a Details toggle showing before and after side by side (code is
 * always left-to-right, gaps G-D4). Used by the audit page and, filtered to one person, by the user detail.
 */
import type { AuditEntry } from '~/services/types'
import { actionKey, dateTime, utc } from '~/utils/admin'

defineProps<{ entries: AuditEntry[]; compact?: boolean }>()
const { t, te, locale } = useI18n()
const open = ref<Set<number>>(new Set())
function toggle(id: number) {
  const s = new Set(open.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  open.value = s
}
const label = (a: string) => (te(`admin.audit.action.${actionKey(a)}`) ? t(`admin.audit.action.${actionKey(a)}`) : a)
const json = (v: unknown) => (v == null ? '—' : JSON.stringify(v, null, 2))
const isUser = (e: AuditEntry) => e.targetType === 'User' && !!e.targetId
</script>

<template>
  <div class="adm-scroll">
    <table class="adm-tbl">
      <caption>{{ t('admin.audit.title') }}</caption>
      <thead>
        <tr>
          <th scope="col">{{ t('admin.audit.when') }}</th>
          <th v-if="!compact" scope="col">{{ t('admin.audit.admin') }}</th>
          <th scope="col">{{ t('admin.audit.action.label') }}</th>
          <th v-if="!compact" scope="col">{{ t('admin.audit.target') }}</th>
          <th scope="col" class="act"><span class="adm-ltr" /></th>
        </tr>
      </thead>
      <tbody>
        <template v-for="e in entries" :key="e.id">
          <tr :class="{ sel: open.has(e.id) }">
            <td class="nowrap" :title="utc(e.createdAt)">{{ dateTime(e.createdAt, locale) }}</td>
            <td v-if="!compact"><span class="adm-ltr" :class="{ 'adm-muted': !e.adminEmail }">{{ e.adminEmail ?? t('admin.audit.deletedAdmin') }}</span></td>
            <td><span class="adm-person"><b>{{ label(e.action) }}</b><small class="adm-ltr">{{ e.action }}</small></span></td>
            <td v-if="!compact">
              <NuxtLink v-if="isUser(e)" class="adm-link" :to="`/admin/users/${encodeURIComponent(e.targetId!)}`">{{ e.targetType }} · <span class="adm-ltr">{{ e.targetId }}</span></NuxtLink>
              <span v-else class="adm-ltr">{{ e.targetType }}{{ e.targetId ? ` · ${e.targetId}` : '' }}</span>
            </td>
            <td class="act">
              <button type="button" class="adm-link" :aria-expanded="open.has(e.id)" @click="toggle(e.id)">{{ open.has(e.id) ? t('admin.audit.hide') : t('admin.audit.details') }}</button>
            </td>
          </tr>
          <tr v-if="open.has(e.id)" class="sel">
            <td :colspan="compact ? 3 : 5">
              <div class="diff">
                <div><p class="adm-muted">{{ t('admin.audit.before') }}</p><pre class="adm-mono">{{ json(e.before) }}</pre></div>
                <div><p class="adm-muted">{{ t('admin.audit.after') }}</p><pre class="adm-mono">{{ json(e.after) }}</pre></div>
              </div>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.diff {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.diff > div {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--tilw-surface-white);
}
pre {
  margin: 4px 0 0;
  white-space: pre-wrap;
  font-size: 12px;
  line-height: 1.6;
}
</style>
