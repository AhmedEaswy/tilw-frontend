<script setup lang="ts">
/**
 * Loading shape of LastOpenedCard: the same stage card, photo, kicker + title, the monitor box (two lines and the
 * paragraph bars) and the two buttons, with the same phone layout (photo beside the title, one button in the monitor).
 * aria-hidden: the page's SkeletonRegion carries the busy state.
 */
import UiSkeleton from '~/components/ui/UiSkeleton.vue'
</script>

<template>
  <div class="card" aria-hidden="true" data-skeleton-card>
    <UiSkeleton class="photo" tone="stage" h="166px" r="9px" />
    <div class="head">
      <UiSkeleton tone="stage" h="15px" w="34%" r="4px" />
      <UiSkeleton class="title" tone="stage" h="40px" w="66%" r="8px" />
    </div>
    <div class="monitor">
      <UiSkeleton tone="stage" h="18px" w="94%" r="4px" />
      <UiSkeleton tone="stage" h="18px" w="62%" r="4px" />
      <div class="pos">
        <UiSkeleton tone="stage" h="12px" w="28%" r="4px" />
        <span class="bars"><i v-for="i in 6" :key="i" /></span>
      </div>
      <UiSkeleton class="rehearse-phone" tone="stage" h="48px" w="120px" r="12px" />
    </div>
    <div class="acts">
      <UiSkeleton tone="stage" h="48px" r="12px" />
      <UiSkeleton tone="stage" h="48px" r="12px" />
    </div>
  </div>
</template>

<style scoped>
/* Mirrors LastOpenedCard.vue's box model; keep the two in step. */
.card {
  display: grid;
  padding: 13px;
  border: 1px solid var(--tilw-border-strong);
  border-radius: var(--tilw-radius-card);
  background: var(--tilw-stage-background);
}
.head {
  display: grid;
  gap: 14px;
  padding: 18px 16px 18px;
}
.title {
  margin-block: 2px 6px;
}
.monitor {
  display: grid;
  gap: 12px;
  padding: 14px 14px 16px;
  border: 1px solid color-mix(in srgb, var(--tilw-stage-secondary) 45%, transparent);
  border-radius: 9px;
  background: var(--tilw-stage-surface);
}
.monitor :deep(.ui-skel.t-stage) {
  --skel-base: color-mix(in srgb, var(--tilw-stage-background) 70%, var(--tilw-stage-surface));
}
.pos {
  display: grid;
  gap: 10px;
  margin-block-start: 4px;
}
.bars {
  display: flex;
  gap: 5px;
}
.bars i {
  flex: 1;
  block-size: 2px;
  border-radius: 1px;
  background: color-mix(in srgb, var(--tilw-stage-secondary) 35%, transparent);
}
.rehearse-phone {
  display: none;
}
.acts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  padding: 26px 14px 10px;
}
@media (max-width: 760px) {
  .card {
    grid-template-columns: 1fr 93px;
    gap: 12px;
    padding: 12px;
  }
  .photo {
    grid-column: 2;
    grid-row: 1;
    block-size: 100px !important;
  }
  .head {
    grid-column: 1;
    grid-row: 1;
    align-content: start;
    gap: 10px;
    padding: 4px 4px 0;
  }
  .title {
    block-size: 30px !important;
  }
  .monitor {
    grid-column: 1 / -1;
    grid-template-columns: 1fr auto;
    align-items: end;
  }
  .monitor > :deep(.ui-skel:not(.rehearse-phone)) {
    grid-column: 1 / -1;
  }
  .pos {
    grid-column: 1;
    grid-row: 3;
  }
  .rehearse-phone {
    display: block;
    grid-column: 2;
    grid-row: 3;
  }
  .acts {
    display: none;
  }
}
</style>
