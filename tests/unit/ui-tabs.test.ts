// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { h } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import UiTabs from '~/components/ui/UiTabs.vue'
import { rovingIndex, type UiTab } from '~/utils/uiControls'
import { uiGlobal } from './ui-mount'

const tabs: UiTab<string>[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta', badge: 3 },
  { value: 'c', label: 'Gamma', disabled: true },
  { value: 'd', label: 'Delta' },
]

let w: VueWrapper | null = null
let host: HTMLElement | null = null
afterEach(() => {
  w?.unmount()
  w = null
  host?.remove()
  host = null
})

function make(props: Record<string, unknown> = {}, dir: 'ltr' | 'rtl' = 'ltr') {
  host = document.createElement('div')
  host.style.direction = dir
  document.body.appendChild(host)
  w = mount(UiTabs, {
    props: { tabs, label: 'Sections', modelValue: 'a', 'onUpdate:modelValue': (v: unknown) => w!.setProps({ modelValue: v }), ...props },
    slots: {
      a: () => h('input', { class: 'in-a' }),
      panel: ({ tab }: { tab: UiTab<string> }) => h('p', { class: 'generic' }, `panel ${tab.label}`),
    },
    global: uiGlobal(),
    attachTo: host,
  })
  return w
}
const tabEls = () => w!.findAll('[role="tab"]')
const selected = () => w!.get('[role="tab"][aria-selected="true"]').text()
const press = async (key: string) => {
  ;(document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  await w!.vm.$nextTick()
  await w!.vm.$nextTick()
}

describe('rovingIndex', () => {
  const items = [{}, { disabled: true }, {}]
  it('follows the reading direction, wraps and skips disabled items', () => {
    expect(rovingIndex(items, 0, 'ArrowRight', false)).toBe(2)
    expect(rovingIndex(items, 2, 'ArrowRight', false)).toBe(0)
    expect(rovingIndex(items, 0, 'ArrowLeft', true)).toBe(2)
    expect(rovingIndex(items, 0, 'ArrowRight', true)).toBe(2) // previous in RTL, wrapping
    expect(rovingIndex(items, 2, 'Home', false)).toBe(0)
    expect(rovingIndex(items, 0, 'End', false)).toBe(2)
    expect(rovingIndex(items, 0, 'ArrowDown', false, true)).toBe(2)
    expect(rovingIndex(items, 0, 'Enter', false)).toBe(-1)
  })
})

describe('UiTabs', () => {
  it('wires tablist, tabs and panels with ARIA', () => {
    make()
    const list = w!.get('[role="tablist"]')
    expect(list.attributes('aria-label')).toBe('Sections')
    const t = tabEls()
    expect(t.map(x => x.attributes('aria-selected'))).toEqual(['true', 'false', 'false', 'false'])
    expect(t.map(x => x.attributes('tabindex'))).toEqual(['0', '-1', '-1', '-1'])
    expect(t[2]!.attributes('aria-disabled')).toBe('true')
    expect(t[1]!.get('.badge').text()).toBe('3')
    const panel = w!.get('[role="tabpanel"]')
    expect(panel.attributes('aria-labelledby')).toBe(t[0]!.attributes('id'))
    expect(t[0]!.attributes('aria-controls')).toBe(panel.attributes('id'))
    expect(panel.find('.in-a').exists()).toBe(true)
  })

  it('arrows select the next enabled tab (automatic activation) and move focus', async () => {
    const m = make()
    ;(tabEls()[0]!.element as HTMLElement).focus()
    await press('ArrowRight')
    expect(selected()).toContain('Beta')
    expect(document.activeElement).toBe(tabEls()[1]!.element)
    await press('ArrowRight') // skips disabled Gamma
    expect(selected()).toBe('Delta')
    await press('ArrowRight') // wraps
    expect(selected()).toBe('Alpha')
    await press('End')
    expect(selected()).toBe('Delta')
    expect(m.emitted('change')!.map(e => e[0])).toEqual(['b', 'd', 'a', 'd'])
  })

  it('RTL: ArrowLeft goes to the next tab', async () => {
    make({}, 'rtl')
    ;(tabEls()[0]!.element as HTMLElement).focus()
    await press('ArrowLeft')
    expect(selected()).toContain('Beta')
  })

  it('manual activation: arrows move focus, Enter selects', async () => {
    make({ manual: true })
    ;(tabEls()[0]!.element as HTMLElement).focus()
    await press('ArrowRight')
    expect(selected()).toBe('Alpha')
    expect(tabEls()[1]!.attributes('tabindex')).toBe('0')
    await press('Enter')
    expect(selected()).toContain('Beta')
  })

  it('clicking a disabled tab does nothing; panels mount lazily and are kept', async () => {
    make()
    await tabEls()[2]!.trigger('click')
    expect(selected()).toBe('Alpha')
    expect(w!.findAll('[role="tabpanel"]')).toHaveLength(1)
    await tabEls()[1]!.trigger('click')
    const panels = w!.findAll('[role="tabpanel"]')
    expect(panels).toHaveLength(2)
    expect(panels[1]!.text()).toBe('panel Beta') // generic #panel slot
    expect((panels[0]!.element as HTMLElement).style.display).toBe('none') // kept, hidden
  })

  it('panels: false renders only the tablist', () => {
    make({ panels: false, controls: 'results' })
    expect(w!.find('[role="tabpanel"]').exists()).toBe(false)
    expect(tabEls()[0]!.attributes('aria-controls')).toBe('results')
  })
})
