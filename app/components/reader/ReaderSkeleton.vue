<script setup lang="ts">
/**
 * Loading shape of the rehearsal monitor (ReaderSurface): the same housing and glass, the position row (paragraph
 * count and progress bars) and a few lines of text with the reading band on the middle one. It fills the stage like
 * the real monitor and follows its phone sizes. aria-hidden: the page's SkeletonRegion carries the busy state.
 */
import UiSkeleton from '~/components/ui/UiSkeleton.vue'

const LINES = ['72%', '84%', '64%', '88%', '58%']
</script>

<template>
  <div class="monitor" aria-hidden="true" data-skeleton-card>
    <div class="row">
      <UiSkeleton tone="stage" h="16px" w="110px" r="4px" />
      <span class="bars"><i v-for="i in 8" :key="i" :class="{ now: i === 1 }" /></span>
    </div>
    <div class="glass">
      <div class="column">
        <span v-for="(w, i) in LINES" :key="i" class="line" :class="{ now: i === 1 }">
          <UiSkeleton tone="stage" h="" :w="w" r="8px" />
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ReaderSurface.vue's housing, row and glass */
.monitor {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-block-size: 0;
  padding: 0 9px 9px;
  border: 1px solid rgba(247, 242, 233, 0.15);
  border-radius: 32px;
  background: linear-gradient(to bottom, #2f3e46, #19272f);
  box-shadow: 0 9px 28px rgba(0, 0, 0, 0.19);
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  block-size: 61px;
  padding-inline: 70px 55px;
}
.bars {
  display: flex;
  align-items: center;
  gap: 6px;
}
.bars i {
  inline-size: 17px;
  block-size: 3px;
  border-radius: 2px;
  background: #626b6f;
}
.bars i.now {
  inline-size: 36px;
  block-size: 4px;
  background: color-mix(in srgb, var(--tilw-stage-cue) 55%, #626b6f);
}
.glass {
  position: relative;
  display: grid;
  align-items: center;
  min-block-size: 320px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.52);
  border-radius: 24px;
  background: linear-gradient(to bottom, #202f38, #273945);
  box-shadow: inset 0 3px 12px rgba(0, 0, 0, 0.3);
}
.column {
  display: grid;
  gap: 26px;
  inline-size: calc(100% - 96px);
  justify-self: center;
  padding-block: 40px;
}
.line {
  display: flex;
  align-items: center;
  block-size: 44px;
}
.line :deep(.ui-skel) {
  block-size: 30px;
}
/* The reading band sits behind the current line, as in the live monitor. */
.line.now {
  margin-inline: -30px;
  padding-inline: 30px;
  border: 1px solid rgba(247, 242, 233, 0.12);
  border-radius: 20px;
  background: linear-gradient(to right, #21333d, #454545);
  block-size: 76px;
}
:dir(ltr) .line.now {
  background: linear-gradient(to left, #21333d, #454545);
}
.line.now :deep(.ui-skel) {
  block-size: 36px;
}
@media (max-width: 760px) {
  .monitor {
    padding: 0 6px 6px;
    border-radius: 26px;
  }
  .row {
    block-size: 53px;
    padding-inline: 24px 32px;
  }
  .bars i {
    inline-size: 12px;
  }
  .bars i.now {
    inline-size: 27px;
  }
  .glass {
    min-block-size: 240px;
    border-radius: 20px;
  }
  .column {
    inline-size: calc(100% - 50px);
    gap: 18px;
  }
  .line {
    block-size: 30px;
  }
  .line :deep(.ui-skel) {
    block-size: 20px;
  }
  .line.now {
    margin-inline: -17px;
    padding-inline: 17px;
    border-radius: 15px;
    block-size: 52px;
  }
  .line.now :deep(.ui-skel) {
    block-size: 24px;
  }
}
@media (max-height: 500px) and (orientation: landscape) {
  .row {
    display: none;
  }
}
</style>
