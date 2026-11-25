/**
 * Dev-only pages: everything under app/pages/dev/ (component showcases) exists in `nuxt dev` only. In builds
 * (`nuxt build` / `nuxt generate`) the routes are removed, so the pages and what only they import never ship.
 * Local modules in modules/ are registered automatically.
 */
import { defineNuxtModule } from '@nuxt/kit'
import type { NuxtPage } from '@nuxt/schema'

export function withoutDevPages(pages: NuxtPage[]): NuxtPage[] {
  return pages.filter(p => !(p.path === '/dev' || p.path.startsWith('/dev/')))
}

export default defineNuxtModule({
  meta: { name: 'tilw-dev-pages' },
  setup(_options, nuxt) {
    if (nuxt.options.dev) return
    nuxt.hook('pages:extend', (pages) => {
      const keep = withoutDevPages(pages)
      pages.splice(0, pages.length, ...keep)
    })
  },
})
