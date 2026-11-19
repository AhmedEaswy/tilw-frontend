<script setup lang="ts">
/**
 * Full-stage countdown from "Camera · countdown" (6:42, phone 6:43): label, cue ring with the seconds
 * left, one bar per second (lit = still to come), the first line to be read, and "إلغاء".
 * Rehearsal shows it under its own header (the reader layout stays); the recording studio reuses it.
 */
const props = defineProps<{
  seconds: number
  total: number
  label: string
  line: string
  direction: 'rtl' | 'ltr'
}>()
const emit = defineEmits<{ cancel: [] }>()
const { t } = useI18n()

const bars = computed(() => Array.from({ length: props.total }, (_, i) => i < props.seconds))
const preview = computed(() => {
  const first = props.line.split(/(?<=[.!؟?،,:])\s+/)[0] ?? props.line
  return first.length > 90 ? `${first.slice(0, 89)}…` : first
})

const cancelBtn = ref<HTMLButtonElement>()
onMounted(() => cancelBtn.value?.focus())
</script>

<template>
  <section class="cd" role="status" :aria-label="`${label} ${seconds}`">
    <p class="label">{{ label }}</p>
    <div class="ring" aria-hidden="true">
      <span class="inset" />
      <span class="num">{{ seconds }}</span>
    </div>
    <div class="bars" aria-hidden="true">
      <i v-for="(on, i) in bars" :key="i" :class="{ on }" />
    </div>
    <p class="line" :dir="direction">{{ preview }}</p>
    <button ref="cancelBtn" type="button" class="cancel" @click="emit('cancel')">{{ t('reader.cancelCountdown') }}</button>
  </section>
</template>

<style scoped>
.cd {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-block-size: 0;
  padding: 88px 24px 51px;
  overflow-y: auto;
  text-align: center;
}
.label {
  margin: 0;
  color: var(--tilw-stage-secondary);
  font: 500 25px/1.36 var(--tilw-font-ar);
}
.ring {
  position: relative;
  display: grid;
  place-items: center;
  inline-size: 204px;
  block-size: 204px;
  margin-block-start: 29px;
  border-radius: 50%;
  background: var(--tilw-stage-cue);
}
.inset {
  position: absolute;
  inset: 5px;
  border-radius: 50%;
  background: linear-gradient(to bottom, #202f38, #273945);
  box-shadow: inset 0 3px 12px rgba(0, 0, 0, 0.3);
}
.num {
  position: relative;
  color: var(--tilw-stage-text);
  font: 700 115px/1.15 var(--tilw-font-lat);
  font-variant-numeric: tabular-nums;
}
.bars {
  display: flex;
  gap: 5px;
  margin-block-start: 25px;
}
.bars i {
  inline-size: 16px;
  block-size: 4px;
  border-radius: 2px;
  background: #626b6f;
  transition: background-color 0.2s;
}
.bars i.on {
  background: var(--tilw-stage-cue);
}
.line {
  max-inline-size: 1220px;
  margin: 53px 0 0;
  color: var(--tilw-stage-secondary);
  font: 400 37px/1.36 var(--tilw-font-ar);
}
.line[dir='ltr'] {
  font-family: var(--tilw-font-lat);
}
.cancel {
  flex: 0 0 auto;
  inline-size: 166px;
  min-block-size: 48px;
  margin-block-start: auto;
  padding-inline: 12px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: var(--tilw-radius-control);
  /* stage colours: the same in light and dark themes, as on 6:42 */
  background: var(--tilw-stage-text);
  color: var(--tilw-stage-background);
  font: var(--tilw-type-control);
}
.cancel:hover {
  background: #fffaf2;
}
.cancel:focus-visible {
  outline: 2px solid var(--tilw-stage-cue);
  outline-offset: 2px;
}
.cancel:active {
  transform: scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .bars i {
    transition: none;
  }
}

/* Phone (6:43) */
@media (max-width: 760px) {
  .cd {
    padding: 70px 16px calc(40px + env(safe-area-inset-bottom, 0px));
  }
  .label {
    font-size: 18px;
  }
  .ring {
    inline-size: 174px;
    block-size: 174px;
    margin-block-start: 30px;
  }
  .num {
    font-size: 98px;
  }
  .bars {
    margin-block-start: 18px;
  }
  .line {
    margin-block-start: 26px;
    font-size: 20px;
  }
}
@media (max-height: 560px) {
  .cd {
    padding-block: 24px;
  }
  .line {
    margin-block-start: 24px;
  }
  .cancel {
    margin-block-start: 24px;
  }
}
</style>
