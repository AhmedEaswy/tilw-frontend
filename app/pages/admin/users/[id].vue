<script setup lang="ts">
/**
 * Admin · user detail (feature 006 US2, Figma D3 `309:1100`, EN D13 `316:2555`, dialogs D4 `310:674`): the person's
 * header with status and every account action, then plan and subscriptions, effective limits with overrides, recent
 * admin activity; on the side credits, storage, sessions and devices, scripts and this month's AI use.
 * Actions the service always refuses are disabled with the reason (FR-010); suspend and deletion need the email typed.
 * Feature 007: `.adm-seg` tabs (in the address as `?tab=`) — Overview (the above), Recordings, Scripts, Connections,
 * Settings (read-only preferences) and Activity; each tab loads its own resource the first time it opens. Actions
 * the admin's permissions don't allow are hidden; the super admin's account is locked.
 */
import { isPortError, type AdminLimitRow, type AdminSubscription, type AuditEntry } from '~/services/types'
import { actionAvailability, dateOnly, dateTime, money, num, utc, type ActionKey } from '~/utils/admin'

definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t, locale } = useI18n()
const route = useRoute()
const auth = useAuthStore()
const user = useAdminUserStore()
const errorText = useErrorText()
const { show } = useToast()
const id = computed(() => String(route.params.id))
const { can } = useAdminPermissions()

// ---------- feature 007: tabs ----------
const TABS = ['overview', 'takes', 'scripts', 'connections', 'settings', 'activity'] as const
type Tab = (typeof TABS)[number]
const tabs = computed(() => TABS.filter(x => x !== 'activity' || can('audit')))
const tab = computed<Tab>(() => {
  const q = String(route.query.tab ?? '')
  return (tabs.value as readonly string[]).includes(q) ? (q as Tab) : 'overview'
})
const tabTo = (x: Tab) => ({ query: { ...route.query, tab: x === 'overview' ? undefined : x } })
const PANELS = {
  takes: resolveComponent('AdminUserTakes'),
  scripts: resolveComponent('AdminUserScripts'),
  connections: resolveComponent('AdminUserConnections'),
  settings: resolveComponent('AdminUserPreferences'),
  activity: resolveComponent('AdminUserActivity'),
}
const panel = computed(() => (tab.value === 'overview' ? null : PANELS[tab.value]))
const d = computed(() => (user.detail?.id === id.value ? user.detail : null))
useHead({ title: () => `${d.value?.name ?? t('admin.nav.users')} · ${t('admin.title')}` })

const history = ref<AdminSubscription[]>([])
const activity = ref<AuditEntry[]>([])
async function loadSide() {
  const api = useServices().admin
  // Feature 007: only what this admin may read (money for subscriptions, audit for the activity).
  const [h, a] = await Promise.allSettled([
    can('money') ? api.userSubscriptions(id.value) : Promise.resolve([]),
    can('audit') ? api.auditLog({ targetType: 'User', targetId: id.value }, null) : Promise.resolve({ items: [], nextCursor: null }),
  ])
  history.value = h.status === 'fulfilled' ? h.value : []
  activity.value = a.status === 'fulfilled' ? a.value.items.slice(0, 5) : []
}
async function load() {
  await user.open(id.value)
  if (!user.gone) void loadSide()
}
watch(id, load, { immediate: true })
watch(() => user.detail, () => d.value && void loadSide())

const avail = computed(() => (d.value ? actionAvailability(d.value, auth.user?.id) : null))
const isSuperTarget = computed(() => d.value?.adminRole === 'super')
function why(k: ActionKey) {
  const w = avail.value?.[k].why
  // Your own account says so first; anyone else's super admin account is locked.
  if (w === 'self') return t('admin.detail.why.self')
  if (isSuperTarget.value && k !== 'reset') return t('admin.detail.why.super')
  return w ? t(`admin.detail.why.${w}`) : undefined
}
/** Feature 007: what this admin may do here (the section's edit level), and never anything to the super admin. */
const allowed = computed(() => ({
  users: can('users', 'edit'),
  money: can('money', 'edit'),
  ai: can('ai', 'edit'),
  plans: can('plans', 'edit'),
  admins: can('admins', 'edit') && !isSuperTarget.value,
}))
const anyAction = computed(() => allowed.value.users || allowed.value.money || allowed.value.ai || allowed.value.admins)
/** The header row: the main actions sit beside the name, the rest in the row under it. */
const moreActions = computed(() => allowed.value.users || (allowed.value.admins && !!(avail.value?.makeAdmin.shown || avail.value?.revokeAdmin.shown)))
const initial = computed(() => (d.value?.name ?? '').trim().charAt(0) || '?')
const name = (ar: string | null, en: string | null) => (locale.value === 'ar' ? ar : en) ?? '—'
const tone = computed(() => (d.value?.status === 'active' ? 'success' : d.value?.status === 'suspended' ? 'error' : 'warning'))
const limitValue = (l: AdminLimitRow) => (l.type === 'bool' ? (l.value ? t('admin.limits.on') : t('admin.limits.off')) : l.type === 'list' ? (Array.isArray(l.value) && l.value.length ? l.value.join(', ') : '—') : l.value === null ? t('admin.limits.unlimited') : num(l.value as number))
const override = (key: string) => d.value?.overrides.find(o => o.key === key)

// ---------- dialogs ----------
type Confirm = 'suspend' | 'unsuspend' | 'reset' | 'makeAdmin' | 'revokeAdmin' | 'scheduleDeletion' | 'cancelDeletion'
const confirm = ref<Confirm | null>(null)
const confirmOpen = computed({ get: () => !!confirm.value, set: v => !v && (confirm.value = null) })
const confirmError = ref('')
const strong = computed(() => confirm.value === 'suspend' || confirm.value === 'scheduleDeletion')
function ask(k: Confirm) {
  confirmError.value = ''
  confirm.value = k
}
async function run(reason: string) {
  const k = confirm.value
  if (!k || !d.value) return
  const api = useServices().admin
  const uid = d.value.id
  try {
    if (k === 'reset') {
      const r = await user.act(k, () => api.sendPasswordReset(uid))
      show(t('admin.detail.done.reset', { email: r.sentTo }), 'success')
    } else {
      const fn = {
        suspend: () => api.suspend(uid, reason),
        unsuspend: () => api.unsuspend(uid),
        makeAdmin: () => api.grantAdmin(uid),
        revokeAdmin: () => api.revokeAdmin(uid),
        scheduleDeletion: () => api.scheduleDeletion(uid, reason),
        cancelDeletion: () => api.cancelDeletion(uid),
      }[k]
      await user.act(k, fn)
      show(t(`admin.detail.done.${k}`, { name: d.value?.name ?? '' }), 'success')
    }
    confirm.value = null
  } catch (e) {
    confirmError.value = isPortError(e, 'conflict') ? t(`admin.detail.conflict.${k}`) : isPortError(e, 'super_admin_locked') ? t('admin.detail.why.super') : errorText(e)
  }
}
const planOpen = ref(false)
const creditsOpen = ref(false)
const overrideFor = ref<AdminLimitRow | null>(null)
const overrideOpen = computed({ get: () => !!overrideFor.value, set: v => !v && (overrideFor.value = null) })
const firstLimit = computed(() => d.value?.limits[0] ?? null)
</script>

<template>
  <div class="adm-page">
    <div v-if="user.gone" class="adm-card adm-card-pad">
      <h1>{{ t('admin.detail.goneTitle') }}</h1>
      <p class="adm-muted">{{ t('admin.detail.goneText') }}</p>
      <NuxtLink to="/admin/users" class="adm-btn">{{ t('admin.detail.backToUsers') }}</NuxtLink>
    </div>
    <div v-else-if="user.error && !d" class="adm-note error" role="alert">
      {{ errorText(user.error) }} <button type="button" class="adm-link" @click="load">{{ t('common.retry') }}</button>
    </div>
    <UiSkeleton v-else-if="!d" h="400px" />

    <template v-if="d && !user.gone">
      <div class="adm-head">
        <p class="adm-crumb"><NuxtLink to="/admin/users">{{ t('admin.nav.users') }}</NuxtLink> / {{ d.name }}</p>
      </div>

      <!-- Header row: the avatar initial, name with its chips and the contact line, the main actions at the end. -->
      <section class="adm-panel uhead" aria-labelledby="u-name">
        <div class="adm-uhead">
          <span class="adm-av" aria-hidden="true">{{ initial }}</span>
          <div class="adm-ident">
            <div class="title">
              <h1 id="u-name">{{ d.name }}</h1>
              <span class="adm-chip" :class="tone" data-testid="status">{{ t(`admin.status.${d.status}`) }}</span>
              <span class="adm-chip info">{{ name(d.plan.nameAr, d.plan.nameEn) }}</span>
              <span v-if="d.adminRole === 'super'" class="adm-chip warning" data-testid="super-chip">{{ t('admin.admins.super') }}</span>
              <span v-else-if="d.isAdmin" class="adm-chip info">{{ t('admin.status.admin') }}</span>
            </div>
            <p class="adm-sub">
              <span class="adm-ltr">{{ d.email }}</span> · {{ t('admin.detail.joined', { date: dateOnly(d.createdAt, locale) }) }}
              · {{ d.lastActiveAt ? t('admin.detail.active', { date: dateTime(d.lastActiveAt, locale) }) : t('admin.detail.neverActive') }} · {{ d.locale === 'ar' ? 'العربية' : 'English' }}
            </p>
          </div>
          <div v-if="allowed.money || allowed.ai" class="adm-ctl" role="group" :aria-label="t('admin.detail.actions')">
            <button v-if="allowed.money" type="button" class="adm-btn" @click="planOpen = true">{{ t('admin.detail.a.changePlan') }}</button>
            <button v-if="allowed.ai" type="button" class="adm-btn" @click="creditsOpen = true">{{ t('admin.detail.a.credits') }}</button>
          </div>
        </div>
        <div v-if="moreActions" class="adm-foot adm-uhead-more" role="group" :aria-label="t('admin.detail.moreActions')">
          <button v-if="allowed.users" type="button" class="adm-btn" :disabled="!avail?.reset.enabled" :title="why('reset')" @click="ask('reset')">{{ t('admin.detail.a.reset') }}</button>
          <button v-if="allowed.admins && avail?.makeAdmin.shown" type="button" class="adm-btn ghost" :disabled="!avail.makeAdmin.enabled" :title="why('makeAdmin')" @click="ask('makeAdmin')">{{ t('admin.detail.a.makeAdmin') }}</button>
          <button v-if="allowed.admins && avail?.revokeAdmin.shown" type="button" class="adm-btn ghost" :disabled="!avail.revokeAdmin.enabled" :title="why('revokeAdmin')" @click="ask('revokeAdmin')">{{ t('admin.detail.a.revokeAdmin') }}</button>
          <template v-if="allowed.users">
            <span class="spacer" />
            <button v-if="avail?.unsuspend.shown" type="button" class="adm-btn" @click="ask('unsuspend')">{{ t('admin.detail.a.unsuspend') }}</button>
            <button v-if="avail?.suspend.shown" type="button" class="adm-btn danger" :disabled="!avail.suspend.enabled || isSuperTarget" :title="why('suspend')" @click="ask('suspend')">{{ t('admin.detail.a.suspend') }}</button>
            <button v-if="avail?.cancelDeletion.shown" type="button" class="adm-btn" @click="ask('cancelDeletion')">{{ t('admin.detail.a.cancelDeletion') }}</button>
            <button v-if="avail?.scheduleDeletion.shown" type="button" class="adm-btn danger" :disabled="!avail.scheduleDeletion.enabled || isSuperTarget" :title="why('scheduleDeletion')" @click="ask('scheduleDeletion')">{{ t('admin.detail.a.scheduleDeletion') }}</button>
          </template>
        </div>
      </section>
      <p v-if="allowed.users && avail && (isSuperTarget || !avail.suspend.enabled || !avail.scheduleDeletion.enabled || !avail.reset.enabled)" class="adm-note" data-testid="why">
        {{ why('suspend') ?? why('scheduleDeletion') ?? why('reset') }}
      </p>
      <p v-else-if="!anyAction" class="adm-note" data-testid="read-only">{{ t('admin.userTabs.readOnly') }}</p>
      <p v-if="d.suspension" class="adm-note error">
        {{ t('admin.detail.suspendedBy', { by: d.suspension.byEmail ?? t('admin.audit.deletedAdmin'), date: dateTime(d.suspension.at, locale), reason: d.suspension.reason }) }}
      </p>
      <p v-if="d.deletionDueAt" class="adm-note warn">
        {{ t('admin.detail.deletionDue', { date: dateOnly(d.deletionDueAt, locale) }) }}
        {{ d.deletionBy ? t('admin.detail.deletionByAdmin') : t('admin.detail.deletionBySelf') }}
      </p>

      <nav class="adm-seg tabs" :aria-label="t('admin.userTabs.label')" data-testid="user-tabs">
        <NuxtLink v-for="x in tabs" :key="x" :to="tabTo(x)" replace :aria-current="tab === x ? 'page' : undefined">{{ t(`admin.userTabs.tab.${x}`) }}</NuxtLink>
      </nav>

      <KeepAlive>
        <component :is="panel" v-if="panel" :key="`${tab}-${d.id}`" :user-id="d.id" />
      </KeepAlive>

      <div v-show="tab === 'overview'" class="grid">
        <div class="col">
          <section v-if="can('money')" class="adm-group" aria-labelledby="ov-plan">
            <div class="adm-ghead"><h2 id="ov-plan">{{ t('admin.detail.plan') }}</h2></div>
            <div class="adm-panel">
              <dl class="adm-kv">
                <div><dt>{{ t('admin.detail.planInForce') }}</dt><dd>{{ name(d.plan.nameAr, d.plan.nameEn) }}{{ d.plan.subscription ? ` · ${t(`admin.period.${d.plan.subscription.period}`)}` : '' }}</dd></div>
                <div v-if="d.plan.subscription"><dt>{{ t('admin.detail.from') }}</dt><dd>{{ dateOnly(d.plan.subscription.startsAt, locale) }}</dd></div>
                <div v-if="d.plan.subscription"><dt>{{ t('admin.detail.to') }}</dt><dd>{{ dateOnly(d.plan.subscription.endsAt, locale) }}</dd></div>
                <div v-if="d.plan.subscription"><dt>{{ t('admin.detail.source') }}</dt><dd>{{ t(`admin.source.${d.plan.subscription.source}`) }}</dd></div>
                <div><dt>{{ t('admin.detail.upcoming') }}</dt><dd>{{ d.plan.upcoming.length ? d.plan.upcoming.map(u => `${u.plan} · ${dateOnly(u.startsAt, locale)}`).join(', ') : t('admin.detail.none') }}</dd></div>
                <div><dt>{{ t('admin.detail.pendingRequest') }}</dt><dd><span v-if="d.plan.pendingRequest" class="adm-ltr">{{ d.plan.pendingRequest.reference }} · {{ money(d.plan.pendingRequest.priceCents) }}</span><span v-else>{{ t('admin.detail.none') }}</span></dd></div>
              </dl>
              <div v-if="history.length" class="adm-scroll">
                <table class="adm-tbl">
                  <caption>{{ t('admin.detail.history') }}</caption>
                  <thead><tr><th scope="col">{{ t('admin.users.plan') }}</th><th scope="col">{{ t('admin.detail.period') }}</th><th scope="col">{{ t('admin.detail.source') }}</th><th scope="col">{{ t('admin.users.status') }}</th></tr></thead>
                  <tbody>
                    <tr v-for="s in history" :key="s.id">
                      <td>{{ s.plan }}</td>
                      <td class="nowrap">{{ dateOnly(s.startsAt, locale) }} – {{ dateOnly(s.endsAt, locale) }}</td>
                      <td>{{ t(`admin.source.${s.source}`) }}</td>
                      <td><span class="adm-chip" :class="s.state === 'active' ? 'success' : s.state === 'scheduled' ? 'info' : ''">{{ t(`admin.subState.${s.state}`) }}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section class="adm-group" aria-labelledby="ov-limits">
            <div class="adm-ghead">
              <h2 id="ov-limits">{{ t('admin.detail.limits') }}</h2>
              <button v-if="allowed.plans" type="button" class="adm-link adm-end" :disabled="!firstLimit" @click="overrideFor = firstLimit">{{ t('admin.detail.addOverride') }}</button>
            </div>
            <div class="adm-panel">
              <div class="adm-scroll">
                <table class="adm-tbl">
                  <caption>{{ t('admin.detail.limits') }}</caption>
                  <thead><tr><th scope="col">{{ t('admin.limits.limit') }}</th><th scope="col">{{ t('admin.limits.value') }}</th><th scope="col" class="n">{{ t('admin.limits.usage') }}</th><th v-if="allowed.plans" scope="col" class="act"><span class="sr">{{ t('admin.limits.edit') }}</span></th></tr></thead>
                  <tbody>
                    <tr v-for="l in d.limits" :key="l.key">
                      <td><span class="adm-person"><b>{{ locale === 'ar' ? l.labelAr : l.labelEn }}</b><small class="adm-ltr">{{ l.key }}</small></span></td>
                      <td>
                        {{ limitValue(l) }}
                        <span v-if="l.overridden" class="adm-chip info">{{ override(l.key)?.endsAt ? t('admin.limits.overrideUntil', { date: dateOnly(override(l.key)!.endsAt, locale) }) : t('admin.limits.override') }}</span>
                      </td>
                      <td class="n">{{ l.usage ?? '—' }}</td>
                      <td v-if="allowed.plans" class="act"><button type="button" class="adm-link" :aria-label="`${t('admin.limits.edit')} · ${locale === 'ar' ? l.labelAr : l.labelEn}`" @click="overrideFor = l">{{ t('admin.limits.edit') }}</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section v-if="can('audit')" class="adm-group" aria-labelledby="ov-activity">
            <div class="adm-ghead">
              <h2 id="ov-activity">{{ t('admin.detail.activity') }}</h2>
              <NuxtLink class="adm-link adm-end" :to="`/admin/audit?targetType=User&targetId=${encodeURIComponent(d.id)}`">{{ t('admin.detail.fullLog') }}</NuxtLink>
            </div>
            <div class="adm-panel">
              <AuditTable v-if="activity.length" :entries="activity" compact />
              <p v-else class="adm-empty">{{ t('admin.detail.noActivity') }}</p>
            </div>
          </section>
        </div>

        <aside class="side">
          <section class="adm-group" aria-labelledby="ov-credits">
            <div class="adm-ghead"><h2 id="ov-credits">{{ t('admin.detail.credits') }}</h2><button v-if="allowed.ai" type="button" class="adm-link adm-end" @click="creditsOpen = true">{{ t('admin.detail.a.credits') }}</button></div>
            <div class="adm-panel">
              <dl class="adm-kv">
                <div><dt>{{ t('admin.detail.balance') }}</dt><dd class="adm-ltr" data-testid="balance">{{ num(d.credits.balance) }}</dd></div>
                <div><dt>{{ t('admin.detail.monthly') }}</dt><dd>{{ t('admin.detail.monthlyLeft', { n: d.credits.monthly, left: d.credits.monthlyLeft }) }}</dd></div>
                <div><dt>{{ t('admin.detail.granted') }}</dt><dd>{{ num(d.credits.granted) }}</dd></div>
                <div><dt>{{ t('admin.detail.month') }}</dt><dd class="adm-ltr">{{ d.credits.month }}</dd></div>
              </dl>
            </div>
          </section>
          <section class="adm-group" aria-labelledby="ov-storage">
            <div class="adm-ghead"><h2 id="ov-storage">{{ t('admin.detail.storage') }}</h2></div>
            <div class="adm-panel">
              <dl class="adm-kv">
                <div><dt>Google Drive</dt><dd class="adm-ltr">{{ d.storage.linked ? d.storage.accountEmail : t('admin.detail.notLinked') }}</dd></div>
                <div v-if="d.storage.linkedAt"><dt>{{ t('admin.detail.linkedSince') }}</dt><dd>{{ dateOnly(d.storage.linkedAt, locale) }}</dd></div>
                <div><dt>{{ t('admin.detail.takes') }}</dt><dd>{{ num(d.storage.takes) }} · {{ formatBytes(d.storage.bytes, locale) }}</dd></div>
              </dl>
            </div>
          </section>
          <section class="adm-group" aria-labelledby="ov-sessions">
            <div class="adm-ghead"><h2 id="ov-sessions">{{ t('admin.detail.sessions') }}</h2></div>
            <div class="adm-panel">
              <dl class="adm-kv">
                <div><dt>{{ t('admin.detail.web') }}</dt><dd>{{ d.sessions.web }}</dd></div>
                <div v-for="dev in d.sessions.devices" :key="dev.id"><dt>{{ dev.name }} · {{ dev.platform }}</dt><dd :title="utc(dev.lastUsedAt)">{{ dev.lastUsedAt ? dateTime(dev.lastUsedAt, locale) : '—' }}</dd></div>
              </dl>
            </div>
          </section>
          <section class="adm-group" aria-labelledby="ov-scripts">
            <div class="adm-ghead"><h2 id="ov-scripts">{{ t('admin.detail.scripts') }}</h2></div>
            <div class="adm-panel">
              <dl class="adm-kv">
                <div><dt>{{ t('admin.detail.activeScripts') }}</dt><dd>{{ d.scripts.active }}</dd></div>
                <div><dt>{{ t('admin.detail.archived') }}</dt><dd>{{ d.scripts.archived }}</dd></div>
              </dl>
            </div>
          </section>
          <section class="adm-group" aria-labelledby="ov-ai">
            <div class="adm-ghead"><h2 id="ov-ai">{{ t('admin.detail.ai') }}</h2></div>
            <div class="adm-panel">
              <dl class="adm-kv">
                <div><dt>{{ t('admin.dash.calls') }}</dt><dd>{{ d.ai.calls }}</dd></div>
                <div><dt>{{ t('admin.detail.failed') }}</dt><dd>{{ d.ai.failed }}</dd></div>
                <div><dt>{{ t('admin.dash.creditsUsed') }}</dt><dd>{{ d.ai.credits }}</dd></div>
                <div><dt>{{ t('admin.detail.ownKey') }}</dt><dd class="adm-ltr">{{ d.ai.ownKey ? `${d.ai.ownKey.provider} · …${d.ai.ownKey.last4}` : t('admin.detail.none') }}</dd></div>
              </dl>
            </div>
          </section>
        </aside>
      </div>
      <AdminConfirmDialog
        v-model:open="confirmOpen"
        :title="confirm ? t(`admin.detail.confirm.${confirm}.title`, { name: d.name }) : ''"
        :text="confirm ? t(`admin.detail.confirm.${confirm}.text`, { name: d.name, email: d.email }) : ''"
        :confirm-label="confirm ? t(`admin.detail.a.${confirm}`) : ''"
        :tone="confirm === 'suspend' || confirm === 'scheduleDeletion' || confirm === 'revokeAdmin' ? 'danger' : 'primary'"
        :reason="strong"
        :type-to-confirm="strong ? d.email : undefined"
        :busy="!!user.busy"
        :error="confirmError"
        @confirm="run"
      />
      <ChangePlanDialog v-model:open="planOpen" :detail="d" />
      <CreditsDialog v-model:open="creditsOpen" :user-id="d.id" :name="d.name" :balance="d.credits.balance" @done="load" />
      <OverrideDialog v-model:open="overrideOpen" :user-id="d.id" :limit="overrideFor" />
    </template>
  </div>
</template>

<style scoped>
.title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
}
.title h1 {
  font: 700 22px/1.35 var(--tilw-font-ar);
}
.uhead .spacer {
  flex: 1;
}
.tabs {
  justify-self: start;
  flex-wrap: wrap;
}
.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 24px;
  align-items: start;
}
.col,
.side {
  display: grid;
  gap: 28px;
}
.side .adm-panel > .adm-kv > div {
  padding-inline: 18px;
}
.side .adm-panel > .adm-kv > div + div::before {
  inset-inline: 18px;
}
.sr {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
@media (max-width: 1100px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
