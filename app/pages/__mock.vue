<script setup lang="ts">
/**
 * Mock backend panel (T017). Phase 1 has no email delivery, so reset and invite links appear in the
 * outbox here. Also toggles latency, failures, conflicts and expired tokens to exercise error states.
 */
import type { MockBackend } from '~/services/mock'
import type { MockKnobs } from '~/services/mock/db'
import { SEED_PASSWORD } from '~/services/mock/seed'

definePageMeta({ layout: false })
useHead({ title: 'Mock backend · tilw', meta: [{ name: 'robots', content: 'noindex' }], htmlAttrs: { dir: 'ltr', lang: 'en' } })

const mock = useNuxtApp().$mock as MockBackend
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
  auth.setUser(null)
  refresh()
  show('Mock data reset to the seed')
}
const fmt = (n: number) => new Date(n).toLocaleString()
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
input[type='number'], input[type='email'] {
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
