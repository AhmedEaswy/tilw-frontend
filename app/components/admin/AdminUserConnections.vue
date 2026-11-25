<script setup lang="ts">
/**
 * Feature 007 · user detail · Connections: linked storage, the own AI key (provider and last 4 only), phone links with
 * their remotes (paged), device tokens and the web session count. Never a token, key or credential.
 */
import type { AdminConnections, AdminLink } from '~/services/types'
import { dateTime, utc } from '~/utils/admin'
import { providerMark, providerName } from '~/utils/adminInsights'

const props = defineProps<{ userId: string }>()
const { t, te, locale } = useI18n()
const data = ref<AdminConnections | null>(null)
const error = ref<unknown>(null)
const errorText = useErrorText()
async function load() {
  error.value = null
  try {
    data.value = await useServices().admin.userConnections(props.userId)
  } catch (e) {
    error.value = e
  }
}
const links = usePagedList(cursor => useServices().admin.userLinks(props.userId, cursor, 20))
onMounted(() => {
  void load()
  void links.reload()
})
const linkTone = (s: AdminLink['state']) => (s === 'connected' ? 'success' : s === 'waiting' ? 'info' : '')
const reason = (r: string | null) => (!r ? '' : te(`admin.userTabs.links.reason.${r}`) ? t(`admin.userTabs.links.reason.${r}`) : r)
</script>

<template>
  <div class="conn" data-testid="tab-connections">
    <div v-if="error" class="adm-note error" role="alert">
      {{ errorText(error) }} <button type="button" class="adm-link" @click="load">{{ t('common.retry') }}</button>
    </div>
    <UiSkeleton v-else-if="!data" h="160px" />
    <div v-else class="cols">
      <section class="adm-group">
        <div class="adm-ghead"><h2>{{ t('admin.userTabs.conn.storage') }}</h2></div>
        <div class="adm-panel">
          <dl v-if="data.storage.length" class="adm-kv">
            <div v-for="s in data.storage" :key="s.provider">
              <dt class="prov"><ProviderMark v-if="providerMark(s.provider)" :provider="providerMark(s.provider)!" :size="16" />{{ providerName(s.provider) }}</dt>
              <dd>
                <span class="adm-ltr">{{ s.accountEmail }}</span>
                <span class="adm-chip" :class="s.state === 'linked' ? 'success' : 'warning'">{{ t(`admin.userTabs.conn.storageState.${s.state}`) }}</span>
                <small class="adm-muted" :title="utc(s.linkedAt)">{{ t('admin.userTabs.conn.since', { date: dateTime(s.linkedAt, locale) }) }}</small>
              </dd>
            </div>
          </dl>
          <p v-else class="adm-muted">{{ t('admin.userTabs.conn.noStorage') }}</p>
        </div>
      </section>

      <section class="adm-group" data-testid="own-key">
        <div class="adm-ghead"><h2>{{ t('admin.userTabs.conn.aiKey') }}</h2></div>
        <div class="adm-panel">
          <dl v-if="data.aiKeys.length" class="adm-kv">
            <div v-for="k in data.aiKeys" :key="`${k.capability}-${k.provider}`">
              <dt class="prov"><ProviderMark :provider="k.provider" :size="16" />{{ providerName(k.provider) }}</dt>
              <dd>
                <span class="adm-ltr">…{{ k.last4 }}</span>
                <span class="adm-chip" :class="k.checkOk ? 'success' : 'error'">{{ k.checkOk ? t('admin.userTabs.conn.keyOk') : t('admin.userTabs.conn.keyFailed') }}</span>
                <small class="adm-muted" :title="utc(k.checkedAt)">{{ t('admin.userTabs.conn.checked', { date: dateTime(k.checkedAt, locale) }) }}</small>
              </dd>
            </div>
          </dl>
          <p v-else class="adm-muted">{{ t('admin.userTabs.conn.noKey') }}</p>
        </div>
      </section>

      <section class="adm-group">
        <div class="adm-ghead"><h2>{{ t('admin.userTabs.conn.devices') }}</h2></div>
        <div class="adm-panel">
          <dl class="adm-kv">
            <div><dt>{{ t('admin.detail.web') }}</dt><dd class="adm-ltr">{{ data.webSessions }}</dd></div>
            <div v-for="dev in data.devices" :key="dev.id">
              <dt>{{ dev.name }} · {{ t(`admin.userTabs.conn.platform.${dev.platform}`) }}</dt>
              <dd :title="utc(dev.lastUsedAt)">{{ dev.lastUsedAt ? dateTime(dev.lastUsedAt, locale) : '—' }}</dd>
            </div>
          </dl>
          <p v-if="!data.devices.length" class="adm-muted">{{ t('admin.userTabs.conn.noDevices') }}</p>
        </div>
      </section>
    </div>

    <section class="adm-group" data-testid="phone-links">
      <div class="adm-ghead"><h2>{{ t('admin.userTabs.links.title') }}</h2></div>
      <div class="adm-panel">
        <div v-if="links.items.value.length" class="adm-scroll">
          <table class="adm-tbl">
            <caption>{{ t('admin.userTabs.links.title') }}</caption>
            <thead>
              <tr>
                <th scope="col">{{ t('admin.userTabs.links.script') }}</th>
                <th scope="col">{{ t('admin.userTabs.links.host') }}</th>
                <th scope="col">{{ t('admin.userTabs.links.remotes') }}</th>
                <th scope="col">{{ t('admin.userTabs.links.state') }}</th>
                <th scope="col">{{ t('admin.userTabs.links.started') }}</th>
                <th scope="col">{{ t('admin.userTabs.links.ended') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in links.items.value" :key="l.id">
                <td dir="auto">{{ l.scriptTitle ?? '—' }}</td>
                <td>
                  <span class="adm-person">
                    <b>{{ t(`admin.userTabs.links.hostKind.${l.hostKind}`) }}</b>
                    <small>{{ l.hostLabel }} · {{ t(`admin.userTabs.links.player.${l.player}`) }}</small>
                  </span>
                </td>
                <td>
                  <span v-if="!l.remotes.length" class="adm-muted">—</span>
                  <span v-for="r in l.remotes" :key="r.id" class="adm-person">
                    <b>{{ r.name }}</b>
                    <small>{{ t(`admin.userTabs.links.remoteKind.${r.kind}`) }} · {{ t(`admin.userTabs.links.remoteStatus.${r.status}`) }}</small>
                  </span>
                </td>
                <td><span class="adm-chip" :class="linkTone(l.state)">{{ t(`admin.userTabs.links.st.${l.state}`) }}</span></td>
                <td class="nowrap" :title="utc(l.startedAt)">{{ dateTime(l.startedAt, locale) }}</td>
                <td class="nowrap" :title="utc(l.endedAt)">{{ l.endedAt ? dateTime(l.endedAt, locale) : '—' }}<small v-if="l.endReason" class="adm-muted"> · {{ reason(l.endReason) }}</small></td>
              </tr>
            </tbody>
          </table>
        </div>
        <AdminListState
          :loading="links.loading.value" :loaded="links.loaded.value" :error="links.error.value" :empty="!links.items.value.length"
          :done="links.done.value" paged :count="links.items.value.length" :empty-text="t('admin.userTabs.links.empty')"
          @retry="links.reload" @more="links.more"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.conn,
.cols {
  display: grid;
  gap: 28px;
}
.cols {
  gap: 24px;
}
.cols {
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  align-items: start;
}
.prov {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
dd {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
}
td .adm-person + .adm-person {
  margin-block-start: 6px;
}
</style>
