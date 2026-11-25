// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { h } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import UiSkeleton from '~/components/ui/UiSkeleton.vue'
import SkeletonRegion from '~/components/skeleton/SkeletonRegion.vue'
import SkeletonRows from '~/components/skeleton/SkeletonRows.vue'
import SkeletonCard from '~/components/skeleton/SkeletonCard.vue'
import { uiGlobal } from './ui-mount'

let w: VueWrapper | null = null
afterEach(() => {
  w?.unmount()
  w = null
})

describe('UiSkeleton', () => {
  it('is hidden from assistive tech and takes its size from props', () => {
    w = mount(UiSkeleton, { props: { h: '21px', w: '40%', r: '4px', tone: 'stage' } })
    const el = w.element as HTMLElement
    expect(el.getAttribute('aria-hidden')).toBe('true')
    expect(el.style.blockSize).toBe('21px')
    expect(el.style.inlineSize).toBe('40%')
    expect(el.classList.contains('t-stage')).toBe(true)
  })

  it('leaves a size to CSS when given an empty string', () => {
    w = mount(UiSkeleton, { props: { h: '' } })
    expect((w.element as HTMLElement).style.blockSize).toBe('')
  })
})

describe('SkeletonRegion', () => {
  it('marks the region busy with one hidden loading text, and is not a live region', () => {
    w = mount(SkeletonRegion, { slots: { default: () => h(UiSkeleton) }, global: uiGlobal('en') })
    expect(w.attributes('aria-busy')).toBe('true')
    expect(w.attributes('aria-live')).toBeUndefined()
    expect(w.attributes('role')).toBeUndefined()
    expect(w.findAll('.visually-hidden')).toHaveLength(1)
    expect(w.find('.visually-hidden').text()).toBe('Loading…')
  })

  it('can drop the text when nested in another region', () => {
    w = mount(SkeletonRegion, { props: { label: false }, global: uiGlobal('en') })
    expect(w.find('.visually-hidden').exists()).toBe(false)
  })
})

describe('SkeletonRows', () => {
  it('draws the asked number of rows at the real row height, with the chosen parts', () => {
    w = mount(SkeletonRows, { props: { count: 4, height: '76px', lead: 'square', trail: 'menu', variant: 'plain' } })
    const rows = w.findAll('[data-skeleton-row]')
    expect(rows).toHaveLength(4)
    expect((rows[0]!.element as HTMLElement).style.minBlockSize).toBe('76px')
    expect(rows[0]!.find('.lead').exists()).toBe(true)
    expect(rows[0]!.find('.trail.menu').exists()).toBe(true)
    expect(w.classes()).toContain('v-plain')
    expect(w.attributes('aria-hidden')).toBe('true')
  })

  it('varies title widths between rows and can drop the meta line', () => {
    w = mount(SkeletonRows, { props: { count: 2, meta: false } })
    const widths = w.findAll('.txt').map(t => (t.find('.ui-skel').element as HTMLElement).style.inlineSize)
    expect(widths[0]).not.toBe(widths[1])
    expect(w.findAll('.txt')[0]!.findAll('.ui-skel')).toHaveLength(1)
  })
})

describe('SkeletonCard', () => {
  it('composes media, title, lines, pairs and actions from props', () => {
    w = mount(SkeletonCard, { props: { media: '212px', kicker: true, lines: 3, pairs: 2, actions: 2, actionsLayout: 'stack', tone: 'stage' } })
    expect(w.find('.media').exists()).toBe(true)
    expect(w.findAll('.pair')).toHaveLength(2)
    expect(w.findAll('.acts .ui-skel')).toHaveLength(2)
    // every shape on a stage card uses the stage tone
    expect(w.findAll('.ui-skel').every(s => s.classes().includes('t-stage'))).toBe(true)
  })

  it('renders slot content between the text and the actions', () => {
    w = mount(SkeletonCard, { props: { lines: 0, actions: 1 }, slots: { default: () => h('i', { class: 'extra' }) } })
    const body = w.find('.body').element
    const kids = Array.from(body.children)
    expect(kids.findIndex(k => k.classList.contains('extra'))).toBeLessThan(kids.findIndex(k => k.classList.contains('acts')))
  })
})
