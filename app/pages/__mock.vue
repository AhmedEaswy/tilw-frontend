<script setup lang="ts">
/**
 * Mock backend panel (T017). Phase 1 has no email delivery, so reset and invite links appear in the
 * outbox here. Also toggles latency, failures, conflicts and expired tokens to exercise error states.
 */
import type { MockBackend } from '~/services/mock'
import type { MockKnobs } from '~/services/mock/db'
import { SEED_PASSWORD } from '~/services/mock/seed'
import type { MockApp, MockAppState } from '~/services/mock/app'
import type { LinkEndReason } from '~/services/types'

definePageMeta({ layout: false })
useHead({ title: 'Mock backend · tilw', meta: [{ name: 'robots', content: 'noindex' }], htmlAttrs: { dir: 'ltr', lang: 'en' } })

const mock = useNuxtApp().$mock as MockBackend
// With servicesMode 'http' there is no mock backend: this dev page does not exist.
if (!mock) throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
const auth = useAuthStore()
const { show } = useToast()

const tick = ref(0)
const state = computed(() => (tick.value, mock.db.s))
const knobs = reactive<MockKnobs>({ ...mock.db.knobs })
watch(knobs, k => mock.db.setKnobs({ ...k }), { deep: true })

const inviteEmail = ref('')
const sessionEmail = computed(() => (tick.value, state.value.users.find(u => u.id === state.value.sessionUserId)?.email ?? '—'))

onMounted(() => auth.init())

function refresh() {
  tick.value++
}
async function signInSeed() {
  await auth.signIn('layan@example.com', SEED_PASSWORD)
  refresh()
  show('Signed in as layan@example.com')
}
async function signOut() {
  await auth.signOut()
  refresh()
}
function invite() {
  const email = normalizeEmail(inviteEmail.value)
  if (!isEmail(email)) return show('Enter a valid email', 'error')
  const t = Array.from({ length: 2 }, () => Math.random().toString(36).slice(2, 10)).join('')
  mock.db.write((s) => {
    s.invites.push({ token: t, email, expiresAt: Date.now() + 7 * 86_400_000, usedAt: null })
    s.outbox.unshift({ id: `m_${t}`, to: email, kind: 'invite', link: `${location.origin}/invite/${t}`, sentAt: Date.now() })
  })
  inviteEmail.value = ''
  refresh()
}
function resetAll() {
  mock.db.reset()
  mock.knobs.ai.reset()
  auth.setUser(null)
  refresh()
  show('Mock data reset to the seed')
}
const fmt = (n: number) => new Date(n).toLocaleString()

// ---------- release 2: plans, limits, requests, clock, Drive ----------
const userId = computed(() => (tick.value, state.value.sessionUserId))
const needUser = () => {
  if (!userId.value) show('Sign in first', 'error')
  return userId.value
}
const planNow = computed(() => {
  tick.value
  const id = userId.value
  if (!id) return '—'
  const t = mock.knobs.now()
  return state.value.subscriptions.find(x => x.userId === id && x.startsAt <= t && t < x.endsAt)?.plan ?? 'free'
})
const pending = computed(() => (tick.value, userId.value ? mock.knobs.pendingRequest(userId.value) : null))
const limitKeys = computed(() => state.value.limitDefinitions.map(d => d.key))
const limitEdit = reactive({ plan: 'free', key: 'scripts.max_active', value: '20' })
const overrideEdit = reactive({ key: 'takes.max_minutes', value: '1' })
const proPrice = reactive({ monthly: 800, yearly: 7700 })
const clock = reactive({ days: Math.trunc((mock.db.knobs.clockOffsetMs || 0) / 86_400_000), minutes: Math.round(((mock.db.knobs.clockOffsetMs || 0) % 86_400_000) / 60_000) })
watch(clock, c => (knobs.clockOffsetMs = (Number(c.days) || 0) * 86_400_000 + (Number(c.minutes) || 0) * 60_000), { deep: true })

function parseValue(raw: string) {
  const v = raw.trim()
  if (v === '' || v === 'null') return null
  try {
    return JSON.parse(v)
  } catch {
    return v.split(',').map(x => x.trim()).filter(Boolean)
  }
}
function setPlan(key: string) {
  const id = needUser()
  if (!id) return
  mock.knobs.setPlan(id, key)
  refresh()
  show(`Plan: ${key}`)
}
function saveLimit() {
  mock.knobs.setPlanLimit(limitEdit.plan, limitEdit.key, parseValue(limitEdit.value))
  refresh()
  show(`${limitEdit.plan} · ${limitEdit.key} = ${limitEdit.value || 'null'}`)
}
function saveOverride(remove = false) {
  const id = needUser()
  if (!id) return
  mock.knobs.setOverride(id, overrideEdit.key, remove ? undefined : parseValue(overrideEdit.value))
  refresh()
  show(remove ? 'Override removed' : 'Override set')
}
function savePrice() {
  mock.knobs.setPlanPrice('pro', Number(proPrice.monthly), Number(proPrice.yearly))
  refresh()
  show('Pro price saved')
}
function settle(kind: 'fulfil' | 'rejected' | 'expired') {
  const id = needUser()
  if (!id) return
  const ok = kind === 'fulfil' ? mock.knobs.fulfil(id) : mock.knobs.settle(id, kind)
  refresh()
  show(ok ? `Request ${kind === 'fulfil' ? 'fulfilled' : kind}` : 'No pending request', ok ? 'success' : 'error')
}
async function addRemoteTake() {
  const id = needUser()
  if (!id) return
  await mock.knobs.addRemoteOnlyTake(id)
  refresh()
  show('Added a take that is only in Drive')
}
function addPhone() {
  const id = needUser()
  if (!id) return
  mock.knobs.addPhone(id)
  refresh()
  show('Added a phone device')
}

// ---------- feature 004: phone link ----------
const linkOffline = ref(mock.knobs.linkOffline())
watch(linkOffline, v => mock.knobs.setLinkOffline(v))
const endReason = ref<LinkEndReason>('signed_out')
const END_REASONS: LinkEndReason[] = ['owner', 'remote', 'idle', 'script_deleted', 'signed_out', 'device_revoked', 'email_changed', 'account_deleted', 'limit']
// US4: a stand-in Tilw app paired with the studio's code; it runs while this page stays open.
const appCode = ref('')
const app = shallowRef<MockApp | null>(null)
const appState = ref<MockAppState | null>(null)
async function pairApp() {
  try {
    app.value?.stop()
    app.value = await mock.knobs.pairMockApp(appCode.value.replace(/\D/g, ''))
    app.value.subscribe(s => (appState.value = s))
    show('The mock Tilw app is paired')
  } catch (e) {
    show(`Pairing failed: ${(e as Error).message}`)
  }
}
async function appAsksToRead() {
  await app.value?.askToRead().catch(e => show(`Refused: ${(e as Error).message}`))
}
onBeforeUnmount(() => app.value?.stop())

// ---------- feature 005: AI writing tools ----------
const aiKnobs = reactive({ ...mock.knobs.ai.knobs() })
watch(aiKnobs, k => mock.knobs.ai.setKnobs({ ...k }), { deep: true })
const aiBalance = ref<number | null>(null)
const balanceEdit = ref('0')
function readBalance() {
  aiBalance.value = userId.value ? mock.knobs.ai.balance(userId.value) : null
}
function aiGrant() {
  const id = needUser()
  if (!id) return
  mock.knobs.ai.grant(id, 50)
  readBalance()
  show('Granted 50 credits')
}
function aiSetBalance() {
  const id = needUser()
  if (!id) return
  mock.knobs.ai.setBalance(id, Number(balanceEdit.value) || 0)
  readBalance()
  show(`Balance set to ${balanceEdit.value}`)
}
const aiScriptId = ref('s_opening')
function aiBump() {
  const id = needUser()
  if (!id) return
  mock.knobs.bumpScript(id, aiScriptId.value)
  show(`Edited ${aiScriptId.value} as another device`)
}
function aiExpire() {
  mock.knobs.ai.expireSuggestion(aiScriptId.value)
  show(`Suggestion for ${aiScriptId.value} expired`)
}
function aiSettle() {
  mock.knobs.ai.settleExpired()
  readBalance()
  show('Expired permissions settled')
}
onMounted(readBalance)

async function endOpenLink() {
  const link = (await mock.services.links.list().catch(() => [])).find(l => l.state !== 'ended')
  if (!link) return show('No open phone link for the signed-in account')
  mock.knobs.endLink(link.id, endReason.value)
  show(`Ended link ${link.id} (${endReason.value})`)
}
</script>

<template>
  <main class="mock">
    <header>
      <h1>Mock backend</h1>
      <p>Phase 1 runs without a server. Data lives in this browser's localStorage. No email is sent: links appear in the outbox below.</p>
      <nav><NuxtLink to="/">Landing</NuxtLink> · <NuxtLink to="/signin">Sign in</NuxtLink> · <NuxtLink to="/app">App</NuxtLink></nav>
    </header>

    <section>
      <h2>Session</h2>
      <p>Signed in as <b>{{ sessionEmail }}</b>. Seed account: <code>layan@example.com</code> / <code>{{ SEED_PASSWORD }}</code></p>
      <div class="row">
        <UiButton size="sm" @click="signInSeed">Sign in as Layan</UiButton>
        <UiButton size="sm" tone="secondary" @click="signOut">Sign out</UiButton>
        <UiButton size="sm" tone="ghost" @click="resetAll">Reset all mock data</UiButton>
      </div>
    </section>

    <section>
      <h2>Behaviour</h2>
      <div class="knobs">
        <label>Latency (ms) <input v-model.number="knobs.latencyMs" type="number" min="0" step="100"></label>
        <label>Failure rate (0–1) <input v-model.number="knobs.failRate" type="number" min="0" max="1" step="0.1"></label>
        <label class="ck"><input v-model="knobs.offline" type="checkbox"> Offline</label>
        <label class="ck"><input v-model="knobs.forceConflictOnNextSave" type="checkbox"> Conflict on next script save</label>
        <label class="ck"><input v-model="knobs.expireTokens" type="checkbox"> Treat reset/invite links as expired</label>
        <label class="ck"><input v-model="knobs.failPositionSave" type="checkbox"> Reading position saves fail</label>
      </div>
    </section>

    <section>
      <h2>Phone link (feature 004)</h2>
      <p>Open the studio in one tab and <NuxtLink to="/remote">/remote</NuxtLink> in another: they share one link through this browser.</p>
      <div class="row">
        <label class="ck"><input v-model="linkOffline" type="checkbox"> This tab is offline for phone link (kept on reload)</label>
      </div>
      <div class="row">
        <label>End reason
          <select v-model="endReason" aria-label="End reason">
            <option v-for="r in END_REASONS" :key="r" :value="r">{{ r }}</option>
          </select>
        </label>
        <UiButton size="sm" @click="endOpenLink">End the open link</UiButton>
      </div>
      <h3>Tilw app (mock)</h3>
      <div class="row">
        <label>Studio code <input v-model="appCode" inputmode="numeric" aria-label="Studio code for the mock app"></label>
        <UiButton size="sm" @click="pairApp">Pair the mock Tilw app</UiButton>
        <UiButton size="sm" tone="secondary" :disabled="!appState?.paired" @click="appAsksToRead">The app asks to read</UiButton>
      </div>
      <p v-if="appState" data-mock-app>
        App: {{ appState.paired ? 'paired' : 'not paired' }} · reads: {{ appState.player === 'remote' ? 'yes' : 'no' }} ·
        paragraph {{ appState.paragraph + 1 }} · {{ appState.playing ? 'playing' : 'paused' }} · {{ appState.wpm }} wpm
      </p>
    </section>

    <section>
      <h2>AI writing tools (feature 005)</h2>
      <p>Balance: <b data-testid="mock-ai-balance">{{ aiBalance ?? '—' }}</b> <button type="button" class="link" @click="readBalance">refresh</button></p>
      <div class="knobs">
        <label>Formatting
          <select v-model="aiKnobs.format" aria-label="AI formatting">
            <option value="ok">ok</option>
            <option value="slow">slow (4 s)</option>
            <option value="unavailable">unavailable</option>
            <option value="changed_words">changed words</option>
          </select>
        </label>
        <label>Speech provider
          <select v-model="aiKnobs.speech" aria-label="Speech provider">
            <option value="ok">ok</option>
            <option value="failed">failed (refunded)</option>
            <option value="empty">no words</option>
            <option value="overrun">overrun (3× longer)</option>
          </select>
        </label>
        <label class="ck"><input v-model="aiKnobs.keyRefused" type="checkbox"> Own key refused</label>
      </div>
      <div class="row">
        <UiButton size="sm" tone="secondary" @click="aiGrant">Grant 50 credits</UiButton>
        <label>Set balance <input v-model="balanceEdit" type="number" aria-label="Set balance"></label>
        <UiButton size="sm" tone="secondary" @click="aiSetBalance">Set</UiButton>
        <UiButton size="sm" tone="ghost" @click="aiSettle">Settle expired permissions</UiButton>
      </div>
      <div class="row">
        <label>Script id <input v-model="aiScriptId" aria-label="AI script id"></label>
        <UiButton size="sm" tone="secondary" @click="aiBump">Edit from another device</UiButton>
        <UiButton size="sm" tone="ghost" @click="aiExpire">Expire suggestion</UiButton>
      </div>
    </section>

    <section>
      <h2>Plan &amp; limits (release 2)</h2>
      <p>Plan in force: <b>{{ planNow }}</b> · mock clock {{ fmt(mock.knobs.now()) }}</p>
      <div class="row">
        <UiButton size="sm" tone="secondary" @click="setPlan('free')">Free</UiButton>
        <UiButton size="sm" tone="secondary" @click="setPlan('pro')">Pro (1 year)</UiButton>
      </div>
      <form class="row" @submit.prevent="saveLimit">
        <select v-model="limitEdit.plan" aria-label="Plan"><option value="free">free</option><option value="pro">pro</option></select>
        <select v-model="limitEdit.key" aria-label="Limit key"><option v-for="k in limitKeys" :key="k">{{ k }}</option></select>
        <input v-model="limitEdit.value" aria-label="Limit value" placeholder="20 · null · true · google_drive">
        <UiButton size="sm" type="submit">Set plan limit</UiButton>
      </form>
      <form class="row" @submit.prevent="saveOverride()">
        <select v-model="overrideEdit.key" aria-label="Override key"><option v-for="k in limitKeys" :key="k">{{ k }}</option></select>
        <input v-model="overrideEdit.value" aria-label="Override value">
        <UiButton size="sm" type="submit">Set my override</UiButton>
        <UiButton size="sm" tone="ghost" @click="saveOverride(true)">Remove</UiButton>
      </form>
      <form class="row" @submit.prevent="savePrice">
        Pro cents: <input v-model.number="proPrice.monthly" type="number" aria-label="Pro monthly cents"> / month
        <input v-model.number="proPrice.yearly" type="number" aria-label="Pro yearly cents"> / year
        <UiButton size="sm" type="submit">Save price</UiButton>
      </form>
      <label class="ck"><input v-model="knobs.plansDown" type="checkbox"> Plan catalogue unreachable (landing fallback)</label>
    </section>

    <section>
      <h2>Upgrade request</h2>
      <p v-if="pending">Pending <code>{{ pending.reference }}</code> · {{ pending.period }} · ${{ pending.priceCents / 100 }}</p>
      <p v-else class="muted">No pending request.</p>
      <div class="row">
        <UiButton size="sm" @click="settle('fulfil')">Fulfil (Pro starts now)</UiButton>
        <UiButton size="sm" tone="secondary" @click="settle('rejected')">Reject</UiButton>
        <UiButton size="sm" tone="ghost" @click="settle('expired')">Expire</UiButton>
      </div>
    </section>

    <section>
      <h2>Clock</h2>
      <div class="row">
        <label>Days <input v-model.number="clock.days" type="number" step="1"></label>
        <label>Minutes <input v-model.number="clock.minutes" type="number" step="1"></label>
        <UiButton size="sm" tone="ghost" @click="clock.days = 0; clock.minutes = 0">Real time</UiButton>
      </div>
    </section>

    <section>
      <h2>Google Drive (fake)</h2>
      <div class="knobs">
        <label>Mode
          <select v-model="knobs.driveMode" aria-label="Drive mode">
            <option value="ok">ok</option><option value="full">full</option><option value="revoked">revoked</option><option value="slow">slow</option>
          </select>
        </label>
        <label class="ck"><input v-model="knobs.denyDriveConsent" type="checkbox"> Google consent declined</label>
      </div>
      <p>Files in the fake Drive: {{ Object.keys(state.drive.files).length }}</p>
      <div class="row">
        <UiButton size="sm" tone="secondary" @click="addRemoteTake">Add a take from another device</UiButton>
        <UiButton size="sm" tone="secondary" @click="addPhone">Add a phone device</UiButton>
      </div>
    </section>

    <section>
      <h2>Invite someone</h2>
      <form class="row" @submit.prevent="invite">
        <input v-model="inviteEmail" type="email" placeholder="name@example.com" aria-label="Invite email">
        <UiButton size="sm" type="submit">Create invite link</UiButton>
      </form>
      <p class="muted">Seeded invite: <code>/invite/demo-invite</code> for invited@example.com</p>
    </section>

    <section>
      <h2>Outbox <button type="button" class="link" @click="refresh">refresh</button></h2>
      <p v-if="!state.outbox.length" class="muted">Nothing sent yet. Request a password reset or create an invite.</p>
      <table v-else>
        <thead><tr><th>When</th><th>To</th><th>Kind</th><th>Link</th></tr></thead>
        <tbody>
          <tr v-for="m in state.outbox" :key="m.id">
            <td>{{ fmt(m.sentAt) }}</td>
            <td>{{ m.to }}</td>
            <td>{{ m.kind }}</td>
            <td><a v-if="m.link" :href="m.link">{{ m.link.replace(/^https?:\/\/[^/]+/, '') }}</a><span v-else>—</span></td>
          </tr>
        </tbody>
      </table>
    </section>

    <section>
      <h2>Waitlist</h2>
      <p v-if="!state.waitlist.length" class="muted">Empty.</p>
      <ul v-else><li v-for="w in state.waitlist" :key="w.email">{{ w.email }} · {{ fmt(w.createdAt) }}</li></ul>
    </section>
  </main>
</template>

<style scoped>
.mock {
  max-inline-size: 880px;
  margin-inline: auto;
  padding: 40px max(16px, env(safe-area-inset-left, 0px)) 80px max(16px, env(safe-area-inset-right, 0px));
  display: grid;
  gap: 28px;
  font: 400 15px/1.6 var(--tilw-font-lat);
}
h1 { font: 700 32px/1.2 var(--tilw-font-lat); }
h2 { font: 600 19px/1.3 var(--tilw-font-lat); margin-block-end: 10px; }
header { display: grid; gap: 8px; }
section { padding-block-start: 20px; border-block-start: 1px solid var(--tilw-border-subtle); }
.row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.knobs { display: grid; gap: 10px; }
.knobs label { display: flex; gap: 10px; align-items: center; }
input[type='number'], input[type='email'], input:not([type]), select {
  block-size: 40px; padding-inline: 10px; border: 1px solid var(--tilw-border-strong);
  border-radius: 8px; background: var(--tilw-surface-white); min-inline-size: 0;
}
input[type='number'] { inline-size: 100px; }
input[type='email'] { inline-size: min(320px, 100%); }
code { font-family: var(--tilw-font-mono); font-size: 13px; background: var(--tilw-surface-quiet); padding: 1px 6px; border-radius: 4px; }
.muted { color: var(--tilw-text-muted); }
.link { border: 0; background: none; color: var(--tilw-action-primary); font: inherit; font-size: 13px; }
table { inline-size: 100%; border-collapse: collapse; font-size: 14px; display: block; overflow-x: auto; }
th, td { text-align: start; padding: 8px 10px; border-block-end: 1px solid var(--tilw-border-subtle); white-space: nowrap; }
a { color: var(--tilw-action-primary); }
</style>
