// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import UiSelect from '~/components/ui/UiSelect.vue'
import type { UiOption } from '~/utils/uiControls'
import { uiGlobal } from './ui-mount'

const options: UiOption<string>[] = [
  { value: 'free', label: 'Free', hint: '$0' },
  { value: 'pro', label: 'Pro' },
  { value: 'team', label: 'Team', disabled: true },
  { value: 'plus', label: 'Plus', group: 'Extra' },
  { value: 'max', label: 'Max', group: 'Extra' },
]

let w: VueWrapper | null = null
afterEach(() => {
  w?.unmount()
  w = null
})

function make(props: Record<string, unknown> = {}) {
  w = mount(UiSelect, {
    props: { options, modelValue: null, 'onUpdate:modelValue': (v: unknown) => w!.setProps({ modelValue: v }), ...props },
    global: uiGlobal(),
    attachTo: document.body,
  })
  return w
}
const trigger = () => w!.get('[role="combobox"]')
const activeId = () => trigger().attributes('aria-activedescendant')
const activeLabel = () => document.getElementById(activeId()!)!.querySelector('.opt-label')!.textContent

describe('UiSelect', () => {
  it('is a select-only combobox with a placeholder', () => {
    make({ label: 'Plan' })
    const t = trigger()
    expect(t.element.tagName).toBe('BUTTON')
    expect(t.attributes('aria-haspopup')).toBe('listbox')
    expect(t.attributes('aria-expanded')).toBe('false')
    expect(t.attributes('aria-label')).toBe('Plan')
    expect(t.text()).toBe('Choose…')
    const list = w!.get('[role="listbox"]')
    expect(t.attributes('aria-controls')).toBe(list.attributes('id'))
  })

  it('shows the chosen label and marks it selected', async () => {
    make({ modelValue: 'pro' })
    expect(trigger().text()).toBe('Pro')
    await trigger().trigger('click')
    expect(trigger().attributes('aria-expanded')).toBe('true')
    const selected = w!.findAll('[role="option"][aria-selected="true"]')
    expect(selected.map(o => o.text())).toEqual(['Pro'])
    expect(activeLabel()).toBe('Pro')
  })

  it('renders groups as labelled ARIA groups after the ungrouped options', async () => {
    make()
    await trigger().trigger('click')
    const group = w!.get('[role="group"]')
    const labelId = group.attributes('aria-labelledby')!
    expect(document.getElementById(labelId)!.textContent).toBe('Extra')
    expect(group.findAll('[role="option"]').map(o => o.text())).toEqual(['Plus', 'Max'])
  })

  it('opens with ArrowDown, moves over disabled options and chooses with Enter', async () => {
    const m = make()
    await trigger().trigger('keydown', { key: 'ArrowDown' })
    expect(trigger().attributes('aria-expanded')).toBe('true')
    expect(activeLabel()).toBe('Free')
    await trigger().trigger('keydown', { key: 'ArrowDown' })
    await trigger().trigger('keydown', { key: 'ArrowDown' }) // skips the disabled Team
    expect(activeLabel()).toBe('Plus')
    await trigger().trigger('keydown', { key: 'Enter' })
    expect(m.emitted('update:modelValue')!.at(-1)).toEqual(['plus'])
    expect(m.emitted('change')!.at(-1)).toEqual(['plus'])
    expect(trigger().attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger().element)
  })

  it('supports Home / End, and ArrowUp opens on the first option', async () => {
    make({ modelValue: 'pro' })
    await trigger().trigger('keydown', { key: 'End' })
    expect(activeLabel()).toBe('Max')
    await trigger().trigger('keydown', { key: 'Home' })
    expect(activeLabel()).toBe('Free')
    await trigger().trigger('keydown', { key: 'Escape' })
    await trigger().trigger('keydown', { key: 'ArrowUp' })
    expect(activeLabel()).toBe('Free')
  })

  it('Esc closes without choosing and does not reach a surrounding dialog', async () => {
    const m = make({ modelValue: 'free' })
    let reached = false
    const spy = () => (reached = true)
    await trigger().trigger('click')
    await trigger().trigger('keydown', { key: 'ArrowDown' })
    document.body.addEventListener('keydown', spy)
    await trigger().trigger('keydown', { key: 'Escape' })
    document.body.removeEventListener('keydown', spy)
    expect(trigger().attributes('aria-expanded')).toBe('false')
    expect(m.emitted('update:modelValue')).toBeUndefined()
    expect(reached).toBe(false)
  })

  it('type-ahead opens on the matching option', async () => {
    make()
    await trigger().trigger('keydown', { key: 'm' })
    await new Promise(r => setTimeout(r, 0))
    expect(trigger().attributes('aria-expanded')).toBe('true')
    expect(activeLabel()).toBe('Max')
    await trigger().trigger('keydown', { key: 'p' })
    // the buffer is now "mp": no match, the active option stays
    expect(activeLabel()).toBe('Max')
  })

  it('Tab chooses the active option and closes', async () => {
    const m = make()
    await trigger().trigger('keydown', { key: 'ArrowDown' })
    await trigger().trigger('keydown', { key: 'ArrowDown' })
    await trigger().trigger('keydown', { key: 'Tab' })
    expect(m.emitted('update:modelValue')!.at(-1)).toEqual(['pro'])
    expect(trigger().attributes('aria-expanded')).toBe('false')
  })

  it('clicking an option chooses it; disabled options cannot be chosen', async () => {
    const m = make()
    await trigger().trigger('click')
    const opts = w!.findAll('[role="option"]')
    expect(opts[2]!.attributes('aria-disabled')).toBe('true')
    await opts[2]!.trigger('click')
    expect(m.emitted('update:modelValue')).toBeUndefined()
    await opts[1]!.trigger('click')
    expect(m.emitted('update:modelValue')!.at(-1)).toEqual(['pro'])
  })

  it('the clear button resets to null', async () => {
    const m = make({ modelValue: 'pro', clearable: true })
    await w!.get('button.clear').trigger('click')
    expect(m.emitted('update:modelValue')!.at(-1)).toEqual([null])
    expect(w!.find('button.clear').exists()).toBe(false)
  })

  it('disabled and error states', async () => {
    make({ disabled: true, error: 'Choose a plan' })
    expect(trigger().attributes('disabled')).toBeDefined()
    expect(trigger().attributes('aria-invalid')).toBe('true')
    const desc = trigger().attributes('aria-describedby')!
    expect(document.getElementById(desc)!.textContent).toBe('Choose a plan')
    await trigger().trigger('keydown', { key: 'ArrowDown' })
    expect(trigger().attributes('aria-expanded')).toBe('false')
  })

  it('closes on a pointerdown outside', async () => {
    make()
    await trigger().trigger('click')
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    await w!.vm.$nextTick()
    expect(trigger().attributes('aria-expanded')).toBe('false')
  })

  it('submits through a hidden input when named', () => {
    make({ modelValue: 'pro', name: 'plan' })
    expect((w!.get('input[type="hidden"]').element as HTMLInputElement).value).toBe('pro')
  })
})
