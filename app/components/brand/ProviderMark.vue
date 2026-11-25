<script lang="ts">
/** Providers the app names in the interface (AI keys, speech, storage). */
export type ProviderId = 'openai' | 'anthropic' | 'deepgram' | 'google-drive'

/** Product names as each company writes them (not translated). */
export const PROVIDER_NAMES: Record<ProviderId, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  deepgram: 'Deepgram',
  'google-drive': 'Google Drive',
}
</script>

<script setup lang="ts">
/**
 * A provider's official mark, used only to name the integration. OpenAI (knot), Anthropic ("A\" mark) and Deepgram
 * are single-colour marks from `public/brands/*.svg` (paths from Simple Icons, CC0) drawn as a CSS mask, so they take
 * `currentColor` and read in light and dark. Google Drive keeps its own colours (`DriveMark`); `mono` draws it in
 * `currentColor` too. Decorative unless `label` is given (then `role="img"`).
 */
const props = withDefaults(defineProps<{ provider: ProviderId; size?: number; label?: string; mono?: boolean }>(), { size: 20 })
const src = computed(() => `/brands/${props.provider}.svg`)
</script>

<template>
  <DriveMark v-if="provider === 'google-drive'" class="provider-mark" :size="size" :mono="mono" :label="label" />
  <span
    v-else
    class="provider-mark"
    :data-provider="provider"
    :style="{ inlineSize: `${size}px`, blockSize: `${size}px`, maskImage: `url(${src})`, WebkitMaskImage: `url(${src})` }"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
  />
</template>

<style scoped>
.provider-mark {
  display: inline-block;
  flex: none;
  vertical-align: middle;
}
span.provider-mark {
  background: currentColor;
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: contain;
}
</style>
