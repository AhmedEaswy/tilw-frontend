// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import UiCheckbox from '~/components/ui/UiCheckbox.vue'
import UiToggle from '~/components/ui/UiToggle.vue'
import UiChoiceGroup from '~/components/ui/UiChoiceGroup.vue'
import type { UiOption } from '~/utils/uiControls'
import { uiGlobal } from './ui-mount'

let w: VueWrapper | null = null
afterEach(() => {
  w?.unmount()
  w = null
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function make(component: any, props: Record<string, unknown>) {
  w = mount(component, {
    props: { 'onUpdate:modelValue': (v: unknown) => w!.setProps({ modelValue: v }), ...props },
    global: uiGlobal(),
    attachTo: document.body,
  })
  return w
}
const describedText = (el: Element) =>
  el.getAttribute('aria-describedby')!.split(' ').map(id => document.getElementById(id)!.textContent).join(' | ')

describe('UiCheckbox', () => {
  it('is a labelled native checkbox that toggles the model', async () => {
    const m = make(UiCheckbox, { modelValue: false, label: 'Agree', description: 'Needed' })
    const input = w!.get('input[type="checkbox"]')
    expect(w!.get('label').attributes('for')).toBe(input.attributes('id'))
    expect(describedText(input.element)).toBe('Needed')
    await input.setValue(true)
    expect(m.emitted('update:modelValue')!.at(-1)).toEqual([true])
    expect(m.emitted('change')!.at(-1)).toEqual([true])
    expect((input.element as HTMLInputElement).checked).toBe(true)
  })

  it('reflects indeterminate on the native input', async () => {
    make(UiCheckbox, { modelValue: false, label: 'All', indeterminate: true })
    expect((w!.get('input').element as HTMLInputElement).indeterminate).toBe(true)
    await w!.setProps({ indeterminate: false })
    expect((w!.get('input').element as HTMLInputElement).indeterminate).toBe(false)
  })

  it('error and disabled states', () => {
    make(UiCheckbox, { modelValue: false, label: 'Agree', error: 'Required', disabled: true })
    const input = w!.get('input')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('disabled')).toBeDefined()
    expect(describedText(input.element)).toBe('Required')
  })
})

describe('UiToggle', () => {
  it('is a native switch with a label and description', async () => {
    const m = make(UiToggle, { modelValue: false, label: 'Beta', description: 'Try new things' })
    const input = w!.get('input')
    expect(input.attributes('role')).toBe('switch')
    expect(input.attributes('aria-checked')).toBe('false')
    expect(w!.get('label').text()).toBe('Beta')
    expect(describedText(input.element)).toBe('Try new things')
    await input.setValue(true)
    expect(m.emitted('update:modelValue')!.at(-1)).toEqual([true])
    expect(input.attributes('aria-checked')).toBe('true')
  })

  it('ignores changes while busy', async () => {
    const m = make(UiToggle, { modelValue: false, label: 'Beta', busy: true })
    const input = w!.get('input')
    expect(input.attributes('aria-busy')).toBe('true')
    await input.setValue(true)
    expect(m.emitted('update:modelValue')).toBeUndefined()
    expect((input.element as HTMLInputElement).checked).toBe(false)
  })

  it('hideLabel keeps the label for screen readers', () => {
    make(UiToggle, { modelValue: true, label: 'flag.x', hideLabel: true })
    expect(w!.get('.text').classes()).toContain('sr-only')
    expect(w!.get('label').attributes('for')).toBe(w!.get('input').attributes('id'))
  })
})

const options: UiOption<string>[] = [
  { value: 'm', label: 'Monthly' },
  { value: 'y', label: 'Yearly', hint: 'Save 20%' },
  { value: 'l', label: 'Lifetime', disabled: true },
]

describe('UiChoiceGroup', () => {
  it('single: radios sharing a name in a fieldset with a legend', async () => {
    const m = make(UiChoiceGroup, { options, modelValue: 'm', legend: 'Billing', hint: 'Pick one' })
    expect(w!.element.tagName).toBe('FIELDSET')
    expect(w!.get('legend').text()).toBe('Billing')
    expect(describedText(w!.element)).toBe('Pick one')
    const radios = w!.findAll('input[type="radio"]')
    expect(new Set(radios.map(r => r.attributes('name'))).size).toBe(1)
    expect(radios.map(r => (r.element as HTMLInputElement).checked)).toEqual([true, false, false])
    expect(radios[2]!.attributes('disabled')).toBeDefined()
    expect(w!.findAll('label.item')[1]!.text()).toContain('Save 20%')
    await radios[1]!.setValue(true)
    expect(m.emitted('update:modelValue')!.at(-1)).toEqual(['y'])
  })

  it('multiple: checkboxes keep the options order', async () => {
    const m = make(UiChoiceGroup, { options, modelValue: ['y'], multiple: true, label: 'Plans' })
    expect(w!.attributes('aria-label')).toBe('Plans')
    const boxes = w!.findAll('input[type="checkbox"]')
    await boxes[0]!.setValue(true)
    expect(m.emitted('update:modelValue')!.at(-1)).toEqual([['m', 'y']])
    await boxes[1]!.setValue(false)
    expect(m.emitted('update:modelValue')!.at(-1)).toEqual([['m']])
  })

  it('select all is tri-state and leaves disabled options alone', async () => {
    const m = make(UiChoiceGroup, { options, modelValue: ['l'], multiple: '', selectAll: true, label: 'Plans' })
    const all = () => w!.get('.all input').element as HTMLInputElement
    expect(all().checked).toBe(false)
    await w!.findAll('.items input')[0]!.setValue(true)
    expect(all().indeterminate).toBe(true)
    await w!.get('.all input').setValue(true)
    expect(m.emitted('update:modelValue')!.at(-1)).toEqual([['m', 'y', 'l']])
    expect(all().checked).toBe(true)
    await w!.get('.all input').setValue(false)
    expect(m.emitted('update:modelValue')!.at(-1)).toEqual([['l']])
  })

  it('cards variant marks the chosen card', async () => {
    make(UiChoiceGroup, { options, modelValue: 'y', variant: 'cards', legend: 'Plan' })
    expect(w!.classes()).toContain('v-cards')
    expect(w!.findAll('label.item').map(c => c.classes().includes('checked'))).toEqual([false, true, false])
  })

  it('error and disabled states', () => {
    make(UiChoiceGroup, { options, modelValue: null, legend: 'Plan', error: 'Choose one', disabled: true, required: true })
    expect(w!.attributes('aria-invalid')).toBe('true')
    expect(w!.attributes('aria-required')).toBe('true')
    expect(describedText(w!.element)).toBe('Choose one')
    expect(w!.attributes('disabled')).toBeDefined()
  })
})
