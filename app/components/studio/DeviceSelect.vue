<script setup lang="ts">
/**
 * Device row from 6:39 "الأجهزة": glyph and name at the start, the chosen device and a chevron at the end.
 * A native <select> sits over the row so keyboard, screen readers and phones get the platform picker.
 */
import type { GlyphName } from '~/components/ui/UiGlyph.vue'

const model = defineModel<string>({ required: true })
const props = defineProps<{ label: string; icon: GlyphName; devices: MediaDeviceInfo[]; fallback: string }>()
const id = useId()
const current = computed(() => {
  const d = props.devices.find(x => x.deviceId === model.value) ?? props.devices[0]
  return d?.label || props.fallback
})
</script>

<template>
  <div class="dev">
    <label :for="id" class="name"><UiGlyph :name="icon" :size="18" />{{ label }}</label>
    <span class="cur" aria-hidden="true"><span class="txt">{{ current }}</span><UiGlyph name="down" :size="15" /></span>
    <select :id="id" v-model="model" :disabled="devices.length < 2">
      <option v-for="(d, i) in devices" :key="d.deviceId || i" :value="d.deviceId">{{ d.label || `${fallback} ${i + 1}` }}</option>
    </select>
  </div>
</template>

<style scoped>
.dev {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-block-size: 49px;
  padding-inline: 13px 9px;
  border-radius: 8px;
  background: var(--tilw-surface-white);
}
.dev:focus-within {
  box-shadow: 0 0 0 2px var(--tilw-focus-ring);
}
.name {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 9px;
  color: var(--tilw-text-ink);
  font: 500 16px/1.36 var(--tilw-font-ar);
}
.cur {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-inline-size: 0;
  color: var(--tilw-text-muted);
  font: 500 14px/1.36 var(--tilw-font-ar);
}
.txt {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
select {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  opacity: 0;
  cursor: pointer;
}
select:disabled {
  cursor: default;
}
</style>
