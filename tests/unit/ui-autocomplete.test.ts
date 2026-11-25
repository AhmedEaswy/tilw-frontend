// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import UiAutocomplete from '~/components/ui/UiAutocomplete.vue'
import type { UiOption } from '~/utils/uiControls'
import { uiGlobal } from './ui-mount'

const PEOPLE: UiOption<number>[] = [
  { value: 1, label: 'Ahmed Ali', hint: 'ahmed@example.com' },
  { value: 2, label: 'Sara Hassan', hint: 'sara@example.com' },
  { value: 3, label: 'Samir Adel', hint: 'samir@example.com' },
]
const search = (q: string) => PEOPLE.filter(p => p.label.toLowerCase().includes(q.toLowerCase()))

let w: VueWrapper | null = null
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  w?.unmount()
  w = null
  vi.useRealTimers()
})

function make(props: Record<string, unknown> = {}) {
  const source = (props.source as ReturnType<typeof vi.fn>) ?? vi.fn(async (q: string) => search(q))
  w = mount(UiAutocomplete, {
    props: {
      source,
      modelValue: props.multiple ? [] : null,
      'onUpdate:modelValue': (v: unknown) => w!.setProps({ modelValue: v }),
      ...props,
    },
    global: uiGlobal(),
    attachTo: document.body,
  })
  return { w, source }
}
const input = () => w!.get('input[role="combobox"]')
async function type(text: string) {
  await input().trigger('focus')
  await input().setValue(text)
}
async function settle(ms = 250) {
  await vi.advanceTimersByTimeAsync(ms)
  await flushPromises()
}
const optionLabels = () => w!.findAll('[role="option"] .opt-label').map(o => o.text())

describe('UiAutocomplete', () => {
  it('is an ARIA combobox with list autocomplete', () => {
    make({ label: 'Person' })
    const i = input()
    expect(i.attributes('aria-autocomplete')).toBe('list')
    expect(i.attributes('aria-expanded')).toBe('false')
    expect(i.attributes('aria-controls')).toBe(w!.get('[role="listbox"]').attributes('id'))
    expect(i.attributes('aria-label')).toBe('Person')
  })

  it('debounces the source and shows results', async () => {
    const { source } = make()
    await type('s')
    await input().setValue('sa')
    expect(source).not.toHaveBeenCalled()
    expect(input().attributes('aria-busy')).toBe('true')
    await settle()
    expect(source).toHaveBeenCalledTimes(1)
    expect(source.mock.calls[0]![0]).toBe('sa')
    expect(source.mock.calls[0]![1]).toBeInstanceOf(AbortSignal)
    expect(input().attributes('aria-expanded')).toBe('true')
    expect(optionLabels()).toEqual(['Sara Hassan', 'Samir Adel'])
    expect(w!.get('[role="status"]').text()).toBe('Results: 2')
  })

  it('chooses with the keyboard and mirrors the label (single)', async () => {
    const { w: m } = make()
    await type('sa')
    await settle()
    const activeId = () => input().attributes('aria-activedescendant')!
    expect(document.getElementById(activeId())!.textContent).toContain('Sara Hassan')
    await input().trigger('keydown', { key: 'ArrowDown' })
    expect(document.getElementById(activeId())!.textContent).toContain('Samir Adel')
    await input().trigger('keydown', { key: 'ArrowDown' }) // wraps
    expect(document.getElementById(activeId())!.textContent).toContain('Sara Hassan')
    await input().trigger('keydown', { key: 'ArrowUp' })
    await input().trigger('keydown', { key: 'Enter' })
    expect(m.emitted('update:modelValue')!.at(-1)).toEqual([3])
    expect(m.emitted('select')!.at(-1)![0]).toMatchObject({ value: 3, label: 'Samir Adel' })
    expect((input().element as HTMLInputElement).value).toBe('Samir Adel')
    expect(input().attributes('aria-expanded')).toBe('false')
  })

  it('editing the text clears a single choice', async () => {
    const { w: m } = make({ modelValue: 2, selectedOptions: [PEOPLE[1]] })
    expect((input().element as HTMLInputElement).value).toBe('Sara Hassan')
    await type('Sara H')
    expect(m.emitted('update:modelValue')!.at(-1)).toEqual([null])
  })

  it('waits for minChars and says so', async () => {
    const { source } = make({ minChars: 3 })
    await type('sa')
    await settle()
    expect(source).not.toHaveBeenCalled()
    expect(w!.get('.state').text()).toBe('Type at least 3 characters')
    await input().setValue('sam')
    await settle()
    expect(source).toHaveBeenCalledWith('sam', expect.any(AbortSignal))
  })

  it('shows loading, empty and error states', async () => {
    let fail = false
    const source = vi.fn((q: string) => new Promise<UiOption<number>[]>((res, rej) => setTimeout(() => (fail ? rej(new Error('x')) : res(search(q))), 100)))
    make({ source })
    await type('zz')
    await settle(250)
    expect(w!.get('.state').text()).toBe('Searching…')
    await settle(100)
    expect(w!.get('.state').text()).toBe('No results')
    fail = true
    await input().setValue('zzz')
    await settle(350)
    expect(w!.get('.state').text()).toBe("Couldn't load results. Try again.")
  })

  it('drops stale answers and aborts the previous request', async () => {
    const signals: AbortSignal[] = []
    const source = vi.fn((q: string, signal: AbortSignal) => {
      signals.push(signal)
      return new Promise<UiOption<number>[]>(res => setTimeout(() => res(search(q)), q === 'a' ? 500 : 10))
    })
    make({ source, debounce: 0 })
    await type('a')
    await settle(0)
    await input().setValue('sam')
    await settle(20)
    expect(optionLabels()).toEqual(['Samir Adel'])
    expect(signals[0]!.aborted).toBe(true)
    await settle(600)
    expect(optionLabels()).toEqual(['Samir Adel'])
  })

  it('Esc closes the list, then clears the text', async () => {
    make()
    await type('sa')
    await settle()
    await input().trigger('keydown', { key: 'Escape' })
    expect(input().attributes('aria-expanded')).toBe('false')
    await input().trigger('keydown', { key: 'Escape' })
    expect((input().element as HTMLInputElement).value).toBe('')
  })

  it('multiple: chips, toggling, Backspace and aria-multiselectable', async () => {
    const { w: m } = make({ multiple: true, modelValue: [1], selectedOptions: [PEOPLE[0]] })
    expect(w!.get('[role="listbox"]').attributes('aria-multiselectable')).toBe('true')
    expect(w!.findAll('.chip-label').map(c => c.text())).toEqual(['Ahmed Ali'])
    await type('sa')
    await settle()
    await input().trigger('keydown', { key: 'Enter' })
    expect(m.emitted('update:modelValue')!.at(-1)).toEqual([[1, 2]])
    expect((input().element as HTMLInputElement).value).toBe('')
    expect(w!.findAll('.chip-label').map(c => c.text())).toEqual(['Ahmed Ali', 'Sara Hassan'])
    // the remove button is labelled
    expect(w!.findAll('.chip-x')[1]!.attributes('aria-label')).toBe('Remove Sara Hassan')
    await input().trigger('keydown', { key: 'Backspace' })
    expect(m.emitted('update:modelValue')!.at(-1)).toEqual([[1]])
    expect(m.emitted('remove')!.at(-1)![0]).toMatchObject({ value: 2 })
    await w!.get('.chip-x').trigger('click')
    expect(m.emitted('update:modelValue')!.at(-1)).toEqual([[]])
  })

  it('a bare `multiple` attribute turns on multiple mode', () => {
    make({ multiple: '', modelValue: [1], selectedOptions: [PEOPLE[0]] })
    expect(w!.findAll('.chip-label').map(c => c.text())).toEqual(['Ahmed Ali'])
  })

  it('disabled and error states', () => {
    make({ disabled: true, error: 'Required' })
    expect(input().attributes('disabled')).toBeDefined()
    expect(input().attributes('aria-invalid')).toBe('true')
    expect(document.getElementById(input().attributes('aria-describedby')!)!.textContent).toBe('Required')
  })
})
