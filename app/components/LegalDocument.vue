<script setup lang="ts">
/**
 * Legal document page (Figma 6:81 privacy, 6:82 terms): header with signature and home link,
 * document switcher card, and the article. The documents are Arabic-only; in the English UI the
 * article keeps Arabic direction and a note says so.
 */
import type { LegalDoc } from '~/content/legal'

const props = defineProps<{ doc: LegalDoc; current: 'privacy' | 'terms' }>()
const { t, locale } = useI18n()
const contact = useRuntimeConfig().public.contactEmail
useHead({ title: () => `${props.doc.title} · tilwprompter` })
</script>

<template>
  <div class="legal">
    <header class="top">
      <NuxtLink to="/" :aria-label="t('nav.home')"><BrandSignature :width="143" /></NuxtLink>
      <NuxtLink to="/" class="home">{{ t('nav.home') }}</NuxtLink>
    </header>

    <div class="body">
      <article dir="rtl" lang="ar">
        <h1>{{ doc.title }}</h1>
        <!-- The article is Arabic in every UI language, so its own labels are Arabic too. -->
        <p class="updated">آخر تحديث&nbsp;&nbsp;{{ doc.updated }}</p>
        <UiBanner v-if="locale !== 'ar'" tone="info" dir="ltr" lang="en">{{ t('legal.arabicOnly') }}</UiBanner>
        <p class="intro">{{ doc.intro }}</p>

        <section v-for="s in doc.sections" :key="s.heading">
          <h2>{{ s.heading }}</h2>
          <template v-for="(b, i) in s.blocks" :key="i">
            <p v-if="b.type === 'p'">{{ b.text }}</p>
            <ul v-else>
              <li v-for="item in b.items" :key="item">{{ item }}</li>
            </ul>
          </template>
        </section>

        <footer class="contact">
          <h2>تواصل معنا</h2>
          <p class="ltr mail">{{ contact }}</p>
        </footer>
      </article>

      <nav class="switch" :aria-label="t('legal.docs')">
        <p>{{ t('legal.docs') }}</p>
        <NuxtLink to="/privacy" :aria-current="current === 'privacy' ? 'page' : undefined">{{ t('legal.privacy') }}</NuxtLink>
        <NuxtLink to="/terms" :aria-current="current === 'terms' ? 'page' : undefined">{{ t('legal.terms') }}</NuxtLink>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.legal {
  max-inline-size: 1120px;
  margin-inline: auto;
  padding: 0 max(61px, env(safe-area-inset-left, 0px)) 96px max(61px, env(safe-area-inset-right, 0px));
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  block-size: 80px;
  border-block-end: 1px solid var(--tilw-border-subtle);
}
.home {
  min-inline-size: 110px;
  padding-block: 10px;
  text-align: center;
  color: var(--tilw-action-primary);
  font: 500 17px/1.36 var(--tilw-font-ar);
  text-decoration: none;
}
.home:hover {
  text-decoration: underline;
}
.body {
  display: grid;
  grid-template-columns: minmax(0, 676px) 241px;
  justify-content: space-between;
  gap: 48px;
  padding-block-start: 52px;
}
article {
  font: 400 18px/1.58 var(--tilw-font-ar);
  color: var(--tilw-text-ink);
}
h1 {
  font: 700 47px/1.36 var(--tilw-font-ar);
}
.updated {
  margin-block: 18px 30px;
  color: var(--tilw-text-muted);
  font-size: 16px;
}
.intro {
  color: var(--tilw-text-muted);
}
.legal :deep(.ui-banner) {
  margin-block-end: 18px;
}
section,
.contact {
  margin-block-start: 30px;
  padding-block-start: 18px;
  border-block-start: 1px solid var(--tilw-border-subtle);
}
section > * + * {
  margin-block-start: 12px;
}
h2 {
  font: 700 25px/1.36 var(--tilw-font-ar);
  margin-block-end: 12px;
}
ul {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}
li {
  position: relative;
  padding-inline-start: 25px;
}
li::before {
  content: '';
  position: absolute;
  inset-inline-start: 8px;
  inset-block-start: 12px;
  inline-size: 5px;
  block-size: 5px;
  border-radius: 2px;
  background: var(--tilw-action-primary);
}
.contact h2 {
  font: 500 23px/1.36 var(--tilw-font-ar);
}
.mail {
  color: var(--tilw-action-primary);
  font: 500 19px/1.36 var(--tilw-font-lat);
  text-align: end;
}
.switch {
  align-self: start;
  position: sticky;
  inset-block-start: 24px;
  display: grid;
  gap: 7px;
  padding: 20px 15px 18px;
  border-radius: 9px;
  background: var(--tilw-surface-white);
}
.switch p {
  padding-inline: 2px 12px;
  margin-block-end: 12px;
  color: var(--tilw-text-muted);
  font: 500 18px/1.36 var(--tilw-font-ar);
}
.switch a {
  display: flex;
  align-items: center;
  min-block-size: 40px;
  padding-inline: 12px;
  border-radius: 6px;
  color: var(--tilw-text-muted);
  font: 400 16px/1.36 var(--tilw-font-ar);
  text-decoration: none;
}
.switch a:hover {
  color: var(--tilw-text-ink);
}
.switch a[aria-current='page'] {
  background: var(--tilw-surface-selected);
  color: var(--tilw-action-primary);
  font-weight: 500;
}

@media (max-width: 900px) {
  .legal {
    padding-inline: max(20px, env(safe-area-inset-left, 0px)) max(20px, env(safe-area-inset-right, 0px));
  }
  .body {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
    padding-block-start: 28px;
  }
  .switch {
    order: -1;
    position: static;
    grid-template-columns: 1fr 1fr;
    padding: 6px;
  }
  .switch p {
    display: none;
  }
  .switch a {
    justify-content: center;
  }
  h1 {
    font-size: 34px;
  }
}
</style>
