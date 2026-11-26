<script setup lang="ts">
/**
 * Single-colour interface glyph from Figma "Glyph" (5:95). The downloaded SVG is used as a mask so the
 * glyph takes `currentColor`. `next`/`prev` follow reading direction: in RTL, "next" points left (Figma
 * variants next-rtl / prev-rtl reuse the prev / next artwork).
 */
export type GlyphName =
  | 'play' | 'pause' | 'next' | 'prev' | 'close' | 'back' | 'arr' | 'settings' | 'expand' | 'search'
  | 'mic' | 'video' | 'file' | 'download' | 'check' | 'more' | 'menu' | 'rewind' | 'pin' | 'headset'
  | 'clock' | 'stop' | 'plus' | 'down' | 'up' | 'sun' | 'keyboard' | 'mail' | 'edit' | 'copy'
  | 'archive' | 'language' | 'privacy' | 'dashboard'
  // form controls (UiSelect, UiDatePicker, UiSearchField)
  | 'calendar' | 'chevron-down' | 'hash'
  // field and action icons from the sign-in frame (6:62)
  | 'field-mail' | 'field-lock' | 'arrow-action'
  // auth state icons (6:64, 6:101, 6:102)
  | 'mail-check' | 'play-small' | 'arrow-back'
  // door with an arrow leaving it
  | 'sign-out'
  // the library's sort direction
  | 'sort-asc' | 'sort-desc'

const props = withDefaults(defineProps<{ name: GlyphName; size?: number; label?: string }>(), { size: 24 })

const { localeProperties } = useI18n()
const rtl = computed(() => localeProperties.value.dir === 'rtl')

// Glyphs drawn as an inset group in Figma (outer inset minus the stroke bleed of the inner image).
const INSET: Partial<Record<GlyphName, string>> = {
  mail: '19.48% 9.07%',
  edit: '11.97% 11.97% 9.9% 9.9%',
  copy: '9.07% 13.24% 9.07% 9.07%',
  archive: '13.23% 9.07%',
  language: '9.07%',
  privacy: '8.23% 13.23% 6.98% 13.23%',
  'field-mail': '17.29% 8.96%',
  'field-lock': '8.96% 17.29%',
  'arrow-action': '21.46% 17.29%',
  'arrow-back': '21.46% 17.29%',
  'mail-check': '13.12% 4.79% 15.2% 8.96%',
  'play-small': '17.29% 21.46% 17.29% 29.79%',
}

const file = computed(() => {
  if (rtl.value && props.name === 'next') return 'prev'
  if (rtl.value && props.name === 'prev') return 'next'
  return props.name
})
// The directional glyphs are drawn for Arabic: `arr`/`arrow-action` point left (forward in RTL),
// `back`/`arrow-back` point right (back in RTL), `sign-out` leaves its door leftwards. They mirror in English.
const RTL_NATIVE = new Set<GlyphName>(['arr', 'back', 'arrow-action', 'arrow-back', 'play-small', 'sign-out'])
const mirror = computed(() => !rtl.value && RTL_NATIVE.has(props.name))
</script>

<template>
  <span
    class="ui-glyph"
    :style="{ inlineSize: `${size}px`, blockSize: `${size}px` }"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
  >
    <i
      :style="{
        inset: INSET[name] ?? '0',
        maskImage: `url(/glyphs/${file}.svg)`,
        WebkitMaskImage: `url(/glyphs/${file}.svg)`,
        transform: mirror ? 'scaleX(-1)' : undefined,
      }"
    />
  </span>
</template>

<style scoped>
.ui-glyph {
  position: relative;
  display: inline-block;
  flex: 0 0 auto;
  vertical-align: middle;
}
.ui-glyph i {
  position: absolute;
  background: currentColor;
  mask-repeat: no-repeat;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-size: 100% 100%;
}
</style>
