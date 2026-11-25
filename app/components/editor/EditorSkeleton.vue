<script setup lang="ts">
/**
 * Loading shape of the editor (6:19 / 6:21): the canvas (title over a hairline, paragraphs of body text, the word
 * count footer) beside the writing tools (the dark session box, the two buttons, the tools list), on the same grid and
 * breakpoints as scripts/[id]/index.vue. On a narrow screen the tools drop under the canvas, and on a phone only their
 * list stays, as in the real page. aria-hidden: the page's SkeletonRegion carries the busy state.
 */
import UiSkeleton from '~/components/ui/UiSkeleton.vue'

// Paragraph shapes: line widths per paragraph, the last line of each shorter.
const PARAS = [['96%', '91%', '58%'], ['94%', '88%', '93%', '41%'], ['90%', '67%']]
</script>

<template>
  <div class="grid" aria-hidden="true">
    <div class="canvas" data-skeleton-card>
      <div class="title"><UiSkeleton h="44px" w="52%" r="8px" /></div>
      <div class="sheet">
        <div v-for="(p, i) in PARAS" :key="i" class="para">
          <UiSkeleton v-for="(w, k) in p" :key="k" class="line" :w="w" r="5px" />
        </div>
      </div>
      <div class="count"><UiSkeleton h="13px" w="128px" r="4px" /></div>
    </div>

    <div class="tools" data-skeleton-card>
      <div class="session">
        <UiSkeleton tone="stage" h="25px" w="46%" />
        <span class="dur"><UiSkeleton h="16px" w="60%" r="4px" /></span>
      </div>
      <div class="acts">
        <UiSkeleton h="48px" r="12px" />
        <UiSkeleton h="48px" r="12px" />
      </div>
      <hr>
      <UiSkeleton class="h3" h="22px" w="40%" />
      <ul>
        <li v-for="w in ['62%', '48%', '56%', '44%', '52%', '38%']" :key="w">
          <UiSkeleton h="18px" w="18px" r="4px" /><UiSkeleton h="16px" :w="w" r="4px" />
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
/* Same columns as the editor page's .grid */
.grid {
  display: grid;
  grid-template-columns: minmax(0, 831fr) minmax(260px, 298fr);
  gap: 33px;
  align-items: start;
}
/* EditorCanvas.vue box model */
.canvas {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-block-size: 635px;
  padding: 34px 44px 14px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: 12px;
  background: var(--tilw-surface-white);
}
.title {
  display: flex;
  align-items: center;
  block-size: 65px;
  padding-block-end: 18px;
  box-sizing: content-box;
  border-block-end: 1px solid var(--tilw-border-subtle);
}
.sheet {
  display: grid;
  align-content: start;
  gap: 42px;
  margin-block: 34px 24px;
  padding-inline: 10px;
}
.para {
  display: grid;
  gap: 17px;
}
.line {
  block-size: 25px !important;
}
.count {
  padding: 12px 8px 4px;
  border-block-start: 1px solid var(--tilw-border-subtle);
}
/* WritingTools.vue box model */
.tools {
  display: grid;
  align-content: start;
  padding: 9px 9px 24px;
  border: 1px solid var(--tilw-border-subtle);
  border-radius: 12px;
  background: var(--tilw-surface-quiet);
}
.tools :deep(.ui-skel.t-paper) {
  --skel-base: var(--tilw-surface-white);
  --skel-hi: color-mix(in srgb, var(--tilw-surface-white) 70%, var(--tilw-surface-quiet));
}
.session {
  display: grid;
  gap: 16px;
  padding: 20px 9px 17px;
  border-radius: 9px;
  background: var(--tilw-stage-background);
}
.dur {
  display: flex;
  align-items: center;
  min-block-size: 43px;
  padding-inline: 10px;
  border-radius: 5px;
  background: var(--tilw-surface-white);
}
.tools .dur :deep(.ui-skel.t-paper) {
  --skel-base: var(--tilw-surface-quiet);
}
.acts {
  display: grid;
  gap: 12px;
  padding: 17px 9px 0;
}
hr {
  margin: 34px 10px 24px;
  border: 0;
  border-block-start: 1px solid var(--tilw-border-subtle);
}
.h3 {
  margin-inline: 10px;
  margin-block-end: 18px;
}
ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0 10px;
  list-style: none;
}
li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-block-size: 43px;
}

@media (max-width: 1000px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 760px) {
  .grid {
    gap: 16px;
  }
  .canvas {
    min-block-size: 0;
    padding: 22px 12px 12px;
  }
  .title {
    block-size: 46px;
  }
  .title :deep(.ui-skel) {
    block-size: 31px !important;
  }
  .sheet {
    gap: 33px;
    padding-inline: 6px;
  }
  .para {
    gap: 14px;
  }
  .line {
    block-size: 19px !important;
  }
  .session,
  .acts,
  hr {
    display: none;
  }
  .tools {
    padding-block-start: 18px;
  }
}
</style>
