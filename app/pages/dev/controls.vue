<script setup lang="ts">
/**
 * Dev-only showcase of the form controls (UiSelect, UiAutocomplete, UiDatePicker, UiSearchField) in every state.
 * Switch language and theme from the toolbar. Not part of builds: modules/dev-pages.ts drops /dev/* outside
 * `nuxt dev`, and the middleware below is a second guard.
 */
import type { UiDateRange, UiOption } from '~/utils/uiControls'

definePageMeta({
  layout: false,
  middleware: () => {
    if (!import.meta.dev) return abortNavigation(createError({ statusCode: 404, statusMessage: 'Not found' }))
  },
})
useHead({ title: 'Form controls · dev', meta: [{ name: 'robots', content: 'noindex' }] })

const { locale, setLocale, localeProperties } = useI18n()
const theme = ref<'light' | 'dark'>('light')
onMounted(() => {
  const set = document.documentElement.getAttribute('data-theme')
  theme.value = set === 'dark' || (!set && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'
})
watch(theme, (v) => {
  if (import.meta.client) document.documentElement.setAttribute('data-theme', v)
})

const ar = computed(() => locale.value === 'ar')
const L = (a: string, e: string) => (ar.value ? a : e)

// --- select
const plan = ref<string | null>('pro')
const planSm = ref<string | null>(null)
const status = ref<string | null>(null)
const planOptions = computed<UiOption<string>[]>(() => [
  { value: 'free', label: L('مجاني', 'Free'), hint: '$0' },
  { value: 'pro', label: L('احترافي', 'Pro'), hint: '$8' },
  { value: 'team', label: L('فريق', 'Team'), hint: '$20', disabled: true },
])
const statusOptions = computed<UiOption<string>[]>(() => [
  { value: 'active', label: L('نشط', 'Active'), group: L('الحساب', 'Account'), icon: 'check' },
  { value: 'suspended', label: L('موقوف', 'Suspended'), group: L('الحساب', 'Account'), icon: 'pause' },
  { value: 'trial', label: L('تجربة', 'Trial'), group: L('الاشتراك', 'Subscription'), icon: 'clock' },
  { value: 'past_due', label: L('متأخر الدفع', 'Past due'), group: L('الاشتراك', 'Subscription'), icon: 'stop' },
  { value: 'canceled', label: L('ملغى', 'Canceled'), group: L('الاشتراك', 'Subscription'), icon: 'close' },
])

// --- autocomplete (fake async source)
const PEOPLE = [
  { id: 1, name: 'Ahmed Ali', email: 'ahmed@example.com' },
  { id: 2, name: 'Sara Hassan', email: 'sara@example.com' },
  { id: 3, name: 'Omar Farouk', email: 'omar@example.com' },
  { id: 4, name: 'Laila Nabil', email: 'laila@example.com' },
  { id: 5, name: 'Youssef Adel', email: 'youssef@example.com' },
  { id: 6, name: 'Mona Said', email: 'mona@example.com' },
]
const failNext = ref(false)
function people(q: string, signal: AbortSignal): Promise<UiOption<number>[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (failNext.value) return reject(new Error('fail'))
      const s = q.toLowerCase()
      resolve(PEOPLE.filter(p => p.name.toLowerCase().includes(s) || p.email.includes(s)).map(p => ({ value: p.id, label: p.name, hint: p.email, data: p })))
    }, 400)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('aborted', 'AbortError'))
    })
  })
}
const person = ref<number | null>(null)
const team = ref<number[]>([2, 3])
const teamKnown: UiOption<number>[] = [
  { value: 2, label: 'Sara Hassan', hint: 'sara@example.com' },
  { value: 3, label: 'Omar Farouk', hint: 'omar@example.com' },
]

// --- dates
const day = ref<string | null>(null)
const daySm = ref<string | null>('2026-11-20')
const period = ref<UiDateRange | null>(null)
const today = new Date()
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const maxDay = iso(today)
const minDay = iso(new Date(today.getFullYear(), today.getMonth() - 6, 1))

// --- search
const q = ref('')
const qEmail = ref('')
const qId = ref('')
const searches = ref<string[]>([])

const dialogOpen = ref(false)
</script>

<template>
  <div class="dev" :dir="localeProperties.dir" :lang="locale">
    <header class="bar">
      <h1>Form controls</h1>
      <div class="adm-seg" role="group" aria-label="Language">
        <button type="button" :aria-pressed="locale === 'ar'" @click="setLocale('ar')">العربية</button>
        <button type="button" :aria-pressed="locale === 'en'" @click="setLocale('en')">English</button>
      </div>
      <div class="adm-seg" role="group" aria-label="Theme">
        <button type="button" :aria-pressed="theme === 'light'" @click="theme = 'light'">Light</button>
        <button type="button" :aria-pressed="theme === 'dark'" @click="theme = 'dark'">Dark</button>
      </div>
      <UiButton size="sm" tone="secondary" @click="dialogOpen = true">{{ L('داخل نافذة', 'Inside a dialog') }}</UiButton>
    </header>

    <section>
      <h2>UiSelect</h2>
      <div class="grid">
        <label class="cell">
          <span id="lbl-plan">{{ L('الخطة', 'Plan') }} (md, clearable)</span>
          <UiSelect v-model="plan" :options="planOptions" clearable aria-labelledby="lbl-plan" />
          <code>{{ plan }}</code>
        </label>
        <div class="cell">
          <label for="sel-status">{{ L('الحالة', 'Status') }} (groups, icons)</label>
          <UiSelect id="sel-status" v-model="status" :options="statusOptions" clearable />
          <code>{{ status }}</code>
        </div>
        <div class="cell">
          <label for="sel-sm">sm</label>
          <UiSelect id="sel-sm" v-model="planSm" :options="planOptions" size="sm" />
        </div>
        <div class="cell">
          <label for="sel-err">error</label>
          <UiSelect id="sel-err" v-model="planSm" :options="planOptions" :error="L('اختر خطة', 'Choose a plan')" />
        </div>
        <div class="cell">
          <label for="sel-dis">disabled</label>
          <UiSelect id="sel-dis" v-model="plan" :options="planOptions" disabled />
        </div>
      </div>
    </section>

    <section>
      <h2>UiAutocomplete</h2>
      <div class="grid">
        <div class="cell">
          <label for="ac-one">{{ L('شخص', 'Person') }} (single)</label>
          <UiAutocomplete id="ac-one" v-model="person" :source="people" />
          <code>{{ person }}</code>
        </div>
        <div class="cell">
          <label for="ac-many">{{ L('الفريق', 'Team') }} (multiple, chips)</label>
          <UiAutocomplete id="ac-many" v-model="team" :source="people" multiple :selected-options="teamKnown" />
          <code>{{ team }}</code>
        </div>
        <div class="cell">
          <label for="ac-min">minChars 3, sm</label>
          <UiAutocomplete id="ac-min" v-model="person" :source="people" :min-chars="3" size="sm" />
        </div>
        <div class="cell">
          <label for="ac-err">error</label>
          <UiAutocomplete id="ac-err" v-model="person" :source="people" :error="L('مطلوب', 'Required')" />
          <label class="inline"><input v-model="failNext" type="checkbox"> source fails</label>
        </div>
        <div class="cell">
          <label for="ac-dis">disabled</label>
          <UiAutocomplete id="ac-dis" v-model="team" :source="people" multiple :selected-options="teamKnown" disabled />
        </div>
      </div>
    </section>

    <section>
      <h2>UiDatePicker</h2>
      <div class="grid">
        <div class="cell">
          <label for="dp-one">{{ L('التاريخ', 'Date') }}</label>
          <UiDatePicker id="dp-one" v-model="day" />
          <code>{{ day }}</code>
        </div>
        <div class="cell">
          <label for="dp-range">{{ L('الفترة', 'Period') }} (range, min/max)</label>
          <UiDatePicker id="dp-range" v-model="period" mode="range" :min="minDay" :max="maxDay" />
          <code>{{ period }}</code>
        </div>
        <div class="cell">
          <label for="dp-sm">sm</label>
          <UiDatePicker id="dp-sm" v-model="daySm" size="sm" />
        </div>
        <div class="cell">
          <label for="dp-err">error</label>
          <UiDatePicker id="dp-err" v-model="day" :error="L('اختر تاريخًا', 'Pick a date')" />
        </div>
        <div class="cell">
          <label for="dp-dis">disabled</label>
          <UiDatePicker id="dp-dis" v-model="daySm" disabled />
        </div>
      </div>
    </section>

    <section>
      <h2>UiSearchField</h2>
      <div class="grid">
        <div class="cell">
          <span>text (debounce 300)</span>
          <UiSearchField v-model="q" @search="searches.unshift($event)" />
          <code>{{ q }} · {{ searches.slice(0, 3) }}</code>
        </div>
        <div class="cell">
          <span>email</span>
          <UiSearchField v-model="qEmail" kind="email" />
        </div>
        <div class="cell">
          <span>id, sm</span>
          <UiSearchField v-model="qId" kind="id" size="sm" />
        </div>
        <div class="cell">
          <span>error</span>
          <UiSearchField v-model="q" :error="L('نص غير صالح', 'Invalid text')" />
        </div>
        <div class="cell">
          <span>disabled</span>
          <UiSearchField v-model="q" disabled />
        </div>
      </div>
    </section>

    <section>
      <h2>Next to native admin inputs</h2>
      <div class="row">
        <input class="adm-input" placeholder="adm-input">
        <select class="adm-select"><option>adm-select</option></select>
        <UiSelect v-model="planSm" :options="planOptions" size="sm" label="Plan" />
        <UiDatePicker v-model="daySm" size="sm" label="Date" />
        <UiSearchField v-model="q" size="sm" />
      </div>
    </section>

    <UiDialog v-model:open="dialogOpen" :title="L('داخل نافذة', 'Inside a dialog')">
      <div class="dialog-body">
        <label for="dlg-sel">{{ L('الحالة', 'Status') }}</label>
        <UiSelect id="dlg-sel" v-model="status" :options="statusOptions" />
        <label for="dlg-ac">{{ L('شخص', 'Person') }}</label>
        <UiAutocomplete id="dlg-ac" v-model="person" :source="people" />
        <label for="dlg-dp">{{ L('الفترة', 'Period') }}</label>
        <UiDatePicker id="dlg-dp" v-model="period" mode="range" />
      </div>
      <template #actions>
        <UiButton @click="dialogOpen = false">OK</UiButton>
      </template>
    </UiDialog>
  </div>
</template>

<style scoped>
@import '~/assets/css/admin.css';

.dev {
  min-block-size: 100vh;
  padding: var(--tilw-space-24);
  background: var(--tilw-surface-paper);
  color: var(--tilw-text-ink);
  font: var(--tilw-type-meta);
}
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--tilw-space-12);
  margin-block-end: var(--tilw-space-24);
}
h1 {
  margin-inline-end: auto;
  font: 700 24px/1.3 var(--tilw-font-ar);
}
h2 {
  margin-block-end: var(--tilw-space-12);
  font: 700 18px/1.4 var(--tilw-font-ar);
}
section {
  margin-block-end: var(--tilw-space-32);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--tilw-space-16);
}
.cell {
  display: grid;
  align-content: start;
  gap: 6px;
  font: 600 13px/1.4 var(--tilw-font-ar);
}
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--tilw-space-12);
}
.row > :deep(.ui-select),
.row > :deep(.ui-date),
.row > :deep(.ui-search) {
  inline-size: 200px;
}
code {
  color: var(--tilw-text-muted);
  font: 400 12px/1.4 var(--tilw-font-mono);
  direction: ltr;
  text-align: start;
}
.inline {
  display: flex;
  gap: 6px;
  align-items: center;
  font-weight: 400;
}
.dialog-body {
  display: grid;
  gap: 8px;
  padding-block: var(--tilw-space-16);
}
</style>
