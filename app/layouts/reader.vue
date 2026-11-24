<script setup lang="ts">
/** Full-bleed dark stage for rehearsal and recording (Figma 6:26, 6:38–6:56). No app nav. */
</script>

<template>
  <div class="stage">
    <slot />
    <!-- Feature 004: the Connect phone panel's locked state offers the release-2 upgrade path from the stage. -->
    <LimitDialog />
    <UpgradeDialog />
  </div>
</template>

<style scoped>
.stage {
  min-block-size: 100dvh;
  background: var(--tilw-stage-background);
  color: var(--tilw-stage-text);
}
</style>
