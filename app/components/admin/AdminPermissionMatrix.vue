<script setup lang="ts">
/**
 * Feature 007: the sections × none / view / edit matrix. One radio group per section (a table row); `edit` includes
 * `view`. The admins section is all-or-nothing: every /admin/admins route needs edit, reads too.
 */
import { ADMIN_SECTIONS, type AdminLevel, type AdminPermissions } from '~/services/types'

const model = defineModel<AdminPermissions>({ required: true })
defineProps<{ disabled?: boolean }>()
const { t } = useI18n()
const uid = useId()
const LEVELS: AdminLevel[] = ['none', 'view', 'edit']
const blocked = (section: string, level: AdminLevel) => section === 'admins' && level === 'view'
function set(section: (typeof ADMIN_SECTIONS)[number], level: AdminLevel) {
  model.value = { ...model.value, [section]: level }
}
function all(level: AdminLevel) {
  model.value = Object.fromEntries(ADMIN_SECTIONS.map(s => [s, s === 'admins' && level === 'view' ? model.value.admins : level])) as AdminPermissions
}
</script>

<template>
  <div class="matrix">
    <table>
      <caption>{{ t('admin.admins.matrix') }}</caption>
      <thead>
        <tr>
          <th scope="col">{{ t('admin.admins.section') }}</th>
          <th v-for="l in LEVELS" :key="l" scope="col" class="c">
            <button type="button" class="adm-link" :disabled="disabled" :aria-label="t('admin.admins.setAll', { level: t(`admin.admins.level.${l}`) })" @click="all(l)">{{ t(`admin.admins.level.${l}`) }}</button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in ADMIN_SECTIONS" :key="s" role="radiogroup" :aria-labelledby="`${uid}-${s}`" :data-section="s">
          <th :id="`${uid}-${s}`" scope="row">
            <span class="sec">{{ t(`admin.admins.sections.${s}`) }}</span>
            <small>{{ t(`admin.admins.sectionHint.${s}`) }}</small>
          </th>
          <td v-for="l in LEVELS" :key="l" class="c">
            <input
              type="radio"
              :name="`${uid}-${s}`"
              :value="l"
              :checked="model[s] === l"
              :disabled="disabled || blocked(s, l)"
              :aria-label="`${t(`admin.admins.sections.${s}`)}: ${t(`admin.admins.level.${l}`)}`"
              :data-testid="`perm-${s}-${l}`"
              @change="set(s, l)"
            >
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.matrix {
  overflow-x: auto;
}
table {
  inline-size: 100%;
  border-collapse: collapse;
  font: 500 13.5px/1.45 var(--tilw-font-ar);
}
caption {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
th,
td {
  padding: 8px 6px;
  text-align: start;
}
tbody tr + tr > * {
  border-block-start: 1px solid var(--tilw-hairline);
}
thead th {
  color: var(--tilw-text-muted);
  font-size: 12px;
  font-weight: 600;
}
.c {
  inline-size: 72px;
  text-align: center;
}
tbody th {
  display: grid;
  gap: 2px;
  font-weight: 500;
}
.sec {
  color: var(--tilw-text-ink);
  font-weight: 600;
}
small {
  color: var(--tilw-text-muted);
  font-size: 12px;
}
input[type='radio'] {
  inline-size: 18px;
  block-size: 18px;
  accent-color: var(--tilw-action-primary);
  cursor: pointer;
}
input:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
</style>
