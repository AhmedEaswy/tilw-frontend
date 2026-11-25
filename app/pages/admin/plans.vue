<script setup lang="ts">
/**
 * Admin · plans and quotas (feature 006 US4, Figma D6 `311:1131`): each plan's names, prices in US dollars, active
 * flag (never for Free) and order; each plan's value for each limit kind (set, or the kind's default); new plans and
 * new limit kinds. Limits are data, not code (release-2 plan): changes apply from the next request.
 */
import { isPortError, type AdminLimitValue, type AdminPlan, type AdminPlanLimit, type LimitDefinition } from '~/services/types'
import { money } from '~/utils/admin'

definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t, locale } = useI18n()
useHead({ title: () => `${t('admin.nav.plans')} · ${t('admin.title')}` })
const admin = useAdminStore()
const { show } = useToast()
const errorText = useErrorText()

const defs = ref<LimitDefinition[]>([])
const error = ref<unknown>(null)
const loaded = ref(false)
async function load() {
  error.value = null
  try {
    const [, d] = await Promise.all([admin.loadPlans(true), useServices().admin.limitDefinitions()])
    defs.value = d
    resetDrafts()
    loaded.value = true
  } catch (e) {
    error.value = e
  }
}
onMounted(load)
const plans = computed(() => admin.plans ?? [])

// ---------- plan cards ----------
interface Draft { nameAr: string; nameEn: string; monthly: string; yearly: string; active: boolean; sort: string }
const drafts = reactive<Record<string, Draft>>({})
const dollars = (c: number) => (c / 100).toFixed(2)
function resetDrafts() {
  for (const p of plans.value) drafts[p.id] = { nameAr: p.nameAr, nameEn: p.nameEn, monthly: dollars(p.priceMonthlyCents), yearly: dollars(p.priceYearlyCents), active: p.active, sort: String(p.sort) }
}
const cents = (s: string) => Math.round(Number(s) * 100)
const busy = ref('')
async function savePlan(p: AdminPlan) {
  const dr = drafts[p.id]!
  if (![dr.monthly, dr.yearly].every(v => v !== '' && Number(v) >= 0) || !dr.nameAr.trim() || !dr.nameEn.trim()) {
    show(t('admin.plans.invalid'), 'error')
    return
  }
  busy.value = p.id
  try {
    await useServices().admin.updatePlan(p.id, { nameAr: dr.nameAr.trim(), nameEn: dr.nameEn.trim(), priceMonthlyCents: cents(dr.monthly), priceYearlyCents: cents(dr.yearly), active: p.key === 'free' ? undefined : dr.active, sort: Number(dr.sort) || 0 })
    await admin.loadPlans(true)
    resetDrafts()
    show(t('admin.plans.saved', { plan: locale.value === 'ar' ? dr.nameAr : dr.nameEn }), 'success')
  } catch (e) {
    show(isPortError(e, 'validation') ? t('admin.plans.invalid') : errorText(e), 'error')
  } finally {
    busy.value = ''
  }
}

// ---------- limit matrix ----------
const label = (d: LimitDefinition) => (locale.value === 'ar' ? d.labelAr : d.labelEn)
const cell = (p: AdminPlan, key: string): AdminPlanLimit | undefined => p.limits.find(l => l.key === key)
const editing = ref<{ plan: AdminPlan; def: LimitDefinition } | null>(null)
const editOpen = computed({ get: () => !!editing.value, set: v => !v && (editing.value = null) })
const ev = reactive({ int: '', unlimited: false, bool: false, list: '' })
function edit(plan: AdminPlan, def: LimitDefinition) {
  const v = cell(plan, def.key)?.value ?? null
  ev.int = typeof v === 'number' ? String(v) : ''
  ev.unlimited = def.type === 'int' && v === null
  ev.bool = v === true
  ev.list = Array.isArray(v) ? v.join(', ') : ''
  editing.value = { plan, def }
}
const editValue = computed<AdminLimitValue | undefined>(() => {
  const d = editing.value?.def
  if (!d) return undefined
  if (d.type === 'bool') return ev.bool
  if (d.type === 'list') return ev.list.split(',').map(s => s.trim()).filter(Boolean)
  if (ev.unlimited) return null
  const n = Number(ev.int)
  return ev.int !== '' && Number.isInteger(n) && n >= 0 ? n : undefined
})
async function saveCell() {
  const e = editing.value
  if (!e || editValue.value === undefined) return
  try {
    await useServices().admin.setPlanLimit(e.plan.id, e.def.key, editValue.value)
    await admin.loadPlans(true)
    editing.value = null
    show(t('admin.plans.limitSaved'), 'success')
  } catch (err) {
    show(errorText(err), 'error')
  }
}
async function unsetCell() {
  const e = editing.value
  if (!e) return
  try {
    await useServices().admin.unsetPlanLimit(e.plan.id, e.def.key)
    await admin.loadPlans(true)
    editing.value = null
    show(t('admin.plans.limitDefault'), 'success')
  } catch (err) {
    show(errorText(err), 'error')
  }
}
function show_(l: AdminPlanLimit | undefined, type: string) {
  const v = l?.value ?? null
  if (type === 'bool') return v ? t('admin.limits.on') : t('admin.limits.off')
  if (type === 'list') return Array.isArray(v) && v.length ? v.join(', ') : '—'
  return v === null ? t('admin.limits.unlimited') : new Intl.NumberFormat('en').format(v as number)
}

// ---------- new plan / new limit kind ----------
const newPlanOpen = ref(false)
const np = reactive({ key: '', nameAr: '', nameEn: '', monthly: '0', yearly: '0' })
const npError = ref('')
async function createPlan() {
  npError.value = ''
  try {
    await useServices().admin.createPlan({ key: np.key.trim(), nameAr: np.nameAr.trim(), nameEn: np.nameEn.trim(), priceMonthlyCents: cents(np.monthly), priceYearlyCents: cents(np.yearly), active: false })
    await admin.loadPlans(true)
    resetDrafts()
    newPlanOpen.value = false
    Object.assign(np, { key: '', nameAr: '', nameEn: '', monthly: '0', yearly: '0' })
  } catch (e) {
    npError.value = isPortError(e, 'validation') ? t('admin.plans.newInvalid') : errorText(e)
  }
}
const newLimitOpen = ref(false)
const nl = reactive({ key: '', type: 'int' as 'int' | 'bool' | 'list', labelAr: '', labelEn: '', counted: false })
const LIMIT_TYPES = (['int', 'bool', 'list'] as const).map(v => ({ value: v, label: v }))
const nlType = computed<string | null>({ get: () => nl.type, set: v => (nl.type = (v ?? 'int') as typeof nl.type) })
const nlError = ref('')
async function createLimit() {
  nlError.value = ''
  try {
    await useServices().admin.defineLimit({ key: nl.key.trim(), type: nl.type, labelAr: nl.labelAr.trim(), labelEn: nl.labelEn.trim(), counted: nl.counted })
    newLimitOpen.value = false
    Object.assign(nl, { key: '', type: 'int', labelAr: '', labelEn: '', counted: false })
    await load()
  } catch (e) {
    nlError.value = isPortError(e, 'validation') ? t('admin.plans.limitInvalid') : errorText(e)
  }
}
</script>

<template>
  <div class="adm-page">
    <div class="adm-head">
      <div>
        <h1>{{ t('admin.nav.plans') }}</h1>
        <p class="adm-sub">{{ t('admin.plans.sub') }}</p>
      </div>
      <div class="adm-actions">
        <button type="button" class="adm-btn" @click="newLimitOpen = true">{{ t('admin.plans.newLimit') }}</button>
        <button type="button" class="adm-btn primary" @click="newPlanOpen = true">{{ t('admin.plans.newPlan') }}</button>
      </div>
    </div>
    <AdminListState :loading="!loaded" :loaded="loaded" :error="error" :empty="false" @retry="load" />

    <div v-if="loaded" class="cards">
      <section v-for="p in plans" :key="p.id" class="adm-card adm-card-pad" :aria-label="p.key">
        <div class="adm-card-head">
          <h2 class="adm-ltr">{{ p.key }}</h2>
          <span class="adm-chip" :class="p.active ? 'success' : ''">{{ p.active ? t('admin.plans.active') : t('admin.plans.inactive') }}</span>
          <span class="adm-muted">{{ money(p.priceMonthlyCents) }} / {{ money(p.priceYearlyCents) }}</span>
        </div>
        <form v-if="drafts[p.id]" class="adm-form" @submit.prevent="savePlan(p)">
          <div class="adm-row">
            <label class="adm-label">{{ t('admin.plans.nameAr') }}<input v-model="drafts[p.id]!.nameAr" class="adm-input" dir="rtl" maxlength="60"></label>
            <label class="adm-label">{{ t('admin.plans.nameEn') }}<input v-model="drafts[p.id]!.nameEn" class="adm-input" dir="ltr" maxlength="60"></label>
          </div>
          <div class="adm-row">
            <label class="adm-label">{{ t('admin.plans.monthly') }}<input v-model="drafts[p.id]!.monthly" class="adm-input adm-ltr" type="number" min="0" step="0.01" :aria-label="`${t('admin.plans.monthly')} ${p.key}`"></label>
            <label class="adm-label">{{ t('admin.plans.yearly') }}<input v-model="drafts[p.id]!.yearly" class="adm-input adm-ltr" type="number" min="0" step="0.01" :aria-label="`${t('admin.plans.yearly')} ${p.key}`"></label>
            <label class="adm-label sort">{{ t('admin.plans.sort') }}<input v-model="drafts[p.id]!.sort" class="adm-input adm-ltr" type="number" step="1"></label>
          </div>
          <div class="adm-row">
            <label class="chk"><input v-model="drafts[p.id]!.active" type="checkbox" :disabled="p.key === 'free'"> {{ t('admin.plans.activeLabel') }}</label>
            <span v-if="p.key === 'free'" class="adm-hint">{{ t('admin.plans.freeAlwaysActive') }}</span>
            <button type="submit" class="adm-btn primary save" :disabled="busy === p.id">{{ t('common.save') }}</button>
          </div>
        </form>
      </section>
    </div>

    <section v-if="loaded" class="adm-card">
      <div class="adm-toolbar"><h2 class="adm-card-title">{{ t('admin.plans.limits') }}</h2><span class="adm-grow adm-muted">{{ t('admin.plans.limitsHint') }}</span></div>
      <div class="adm-scroll">
        <table class="adm-tbl">
          <caption>{{ t('admin.plans.limits') }}</caption>
          <thead><tr><th scope="col">{{ t('admin.limits.limit') }}</th><th v-for="p in plans" :key="p.id" scope="col" class="adm-ltr">{{ p.key }}</th></tr></thead>
          <tbody>
            <tr v-for="d in defs" :key="d.key">
              <th scope="row" class="rowh"><span class="adm-person"><b>{{ label(d) }}</b><small class="adm-ltr">{{ d.key }}</small></span></th>
              <td v-for="p in plans" :key="p.id">
                <button type="button" class="val" :aria-label="`${label(d)} · ${p.key}: ${show_(cell(p, d.key), d.type)}`" @click="edit(p, d)">
                  {{ show_(cell(p, d.key), d.type) }}
                </button>
                <span v-if="!cell(p, d.key)?.set" class="adm-muted"> · {{ t('admin.plans.default') }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <UiDialog v-model:open="editOpen" :title="editing ? `${label(editing.def)} · ${editing.plan.key}` : ''">
      <form v-if="editing" class="adm-form" @submit.prevent="saveCell">
        <template v-if="editing.def.type === 'int'">
          <label class="adm-label">{{ t('admin.limits.value') }}<input v-model="ev.int" class="adm-input adm-ltr" type="number" min="0" step="1" :disabled="ev.unlimited"></label>
          <label class="chk"><input v-model="ev.unlimited" type="checkbox"> {{ t('admin.limits.unlimited') }}</label>
        </template>
        <label v-else-if="editing.def.type === 'bool'" class="chk"><input v-model="ev.bool" type="checkbox"> {{ t('admin.limits.on') }}</label>
        <label v-else class="adm-label">{{ t('admin.override.list') }}<input v-model="ev.list" class="adm-input adm-ltr"></label>
        <div class="adm-dialog-actions">
          <button v-if="cell(editing.plan, editing.def.key)?.set" type="button" class="adm-link rm" @click="unsetCell">{{ t('admin.plans.useDefault') }}</button>
          <button type="button" class="adm-btn" @click="editing = null">{{ t('common.cancel') }}</button>
          <button type="submit" class="adm-btn primary" :disabled="editValue === undefined">{{ t('common.save') }}</button>
        </div>
      </form>
    </UiDialog>

    <UiDialog v-model:open="newPlanOpen" :title="t('admin.plans.newPlan')">
      <form class="adm-form" @submit.prevent="createPlan">
        <label class="adm-label">{{ t('admin.plans.key') }}<input v-model="np.key" class="adm-input adm-ltr" pattern="[a-z0-9_]{2,32}" required><span class="adm-hint">{{ t('admin.plans.keyHint') }}</span></label>
        <div class="adm-row">
          <label class="adm-label">{{ t('admin.plans.nameAr') }}<input v-model="np.nameAr" class="adm-input" dir="rtl" required></label>
          <label class="adm-label">{{ t('admin.plans.nameEn') }}<input v-model="np.nameEn" class="adm-input" dir="ltr" required></label>
        </div>
        <div class="adm-row">
          <label class="adm-label">{{ t('admin.plans.monthly') }}<input v-model="np.monthly" class="adm-input adm-ltr" type="number" min="0" step="0.01"></label>
          <label class="adm-label">{{ t('admin.plans.yearly') }}<input v-model="np.yearly" class="adm-input adm-ltr" type="number" min="0" step="0.01"></label>
        </div>
        <p class="adm-hint">{{ t('admin.plans.newHint') }}</p>
        <p v-if="npError" class="adm-note error" role="alert">{{ npError }}</p>
        <div class="adm-dialog-actions"><button type="button" class="adm-btn" @click="newPlanOpen = false">{{ t('common.cancel') }}</button><button type="submit" class="adm-btn primary">{{ t('admin.plans.create') }}</button></div>
      </form>
    </UiDialog>

    <UiDialog v-model:open="newLimitOpen" :title="t('admin.plans.newLimit')">
      <form class="adm-form" @submit.prevent="createLimit">
        <label class="adm-label">{{ t('admin.plans.key') }}<input v-model="nl.key" class="adm-input adm-ltr" required placeholder="ai.captions_monthly"></label>
        <div class="adm-label"><label for="nl-type">{{ t('admin.plans.type') }}</label><UiSelect id="nl-type" v-model="nlType" :options="LIMIT_TYPES" /></div>
        <div class="adm-row">
          <label class="adm-label">{{ t('admin.plans.labelAr') }}<input v-model="nl.labelAr" class="adm-input" dir="rtl" required></label>
          <label class="adm-label">{{ t('admin.plans.labelEn') }}<input v-model="nl.labelEn" class="adm-input" dir="ltr" required></label>
        </div>
        <label class="chk"><input v-model="nl.counted" type="checkbox"> {{ t('admin.plans.counted') }}</label>
        <p v-if="nlError" class="adm-note error" role="alert">{{ nlError }}</p>
        <div class="adm-dialog-actions"><button type="button" class="adm-btn" @click="newLimitOpen = false">{{ t('common.cancel') }}</button><button type="submit" class="adm-btn primary">{{ t('admin.plans.create') }}</button></div>
      </form>
    </UiDialog>
  </div>
</template>

<style scoped>
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
}
.chk {
  display: flex;
  gap: 8px;
  align-items: center;
  font: 500 14px/1.4 var(--tilw-font-ar);
}
.save {
  margin-inline-start: auto;
}
.sort {
  flex: 0 0 90px !important;
}
.rowh {
  position: static;
  background: none;
  color: var(--tilw-text-ink);
  font-weight: 500;
  padding-block: 12px;
  border-block-end: 1px solid var(--tilw-hairline);
}
/* editable cell: the same filled well as the fields, a pencil on hover/focus */
.val {
  position: relative;
  min-inline-size: 116px;
  padding-block: 7px;
  padding-inline: 12px 32px;
  border: 0;
  border-radius: var(--tilw-radius-field);
  background: var(--tilw-field-fill);
  color: var(--tilw-text-ink);
  font: 600 13.5px/1.3 var(--tilw-font-ar);
  text-align: start;
  cursor: pointer;
  transition: background-color 0.12s;
}
.val::after {
  content: '';
  position: absolute;
  inset-block-start: 50%;
  inset-inline-end: 10px;
  inline-size: 13px;
  block-size: 13px;
  margin-block-start: -6.5px;
  background: var(--tilw-action-primary);
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10.8 2.7l2.5 2.5L6 12.5l-3.3.8.8-3.3z'/%3E%3Cpath d='M9.3 4.2l2.5 2.5'/%3E%3C/svg%3E") center / contain no-repeat;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10.8 2.7l2.5 2.5L6 12.5l-3.3.8.8-3.3z'/%3E%3Cpath d='M9.3 4.2l2.5 2.5'/%3E%3C/svg%3E") center / contain no-repeat;
  opacity: 0;
  transition: opacity 0.12s;
}
.val:hover {
  background: var(--tilw-field-fill-hover);
}
.val:focus-visible {
  outline: 2px solid var(--tilw-focus-ring);
  outline-offset: 0;
}
.val:hover::after,
.val:focus-visible::after {
  opacity: 1;
}
.rm {
  margin-inline-end: auto;
}
</style>
