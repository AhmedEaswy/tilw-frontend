// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import UiSearchField from '~/components/ui/UiSearchField.vue'
import { uiGlobal } from './ui-mount'

let w: VueWrapper | null = null
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  w?.unmount()
  w = null
  vi.useRealTimers()
})

function make(props: Record<string, unknown> = {}) {
  w = mount(UiSearchField, {
    props: { modelValue: '', 'onUpdate:modelValue': (v: unknown) => w!.setProps({ modelValue: v }), ...props },
    global: uiGlobal(),
    attachTo: document.body,
  })
  return w
}
const input = () => w!.get('input')

describe('UiSearchField', () => {
  it('debounces update:modelValue', async () => {
    const m = make()
    await input().setValue('a')
    await input().setValue('ab')
    expect(m.emitted('update:modelValue')).toBeUndefined()
    vi.advanceTimersByTime(299)
    expect(m.emitted('update:modelValue')).toBeUndefined()
    vi.advanceTimersByTime(1)
    expect(m.emitted('update:modelValue')).toEqual([['ab']])
  })

  it('debounce 0 updates on every keystroke', async () => {
    const m = make({ debounce: 0 })
    await input().setValue('x')
    expect(m.emitted('update:modelValue')).toEqual([['x']])
  })

  it('Enter updates at once and emits search', async () => {
    const m = make()
    await input().setValue('ahmed')
    await input().trigger('keydown', { key: 'Enter' })
    expect(m.emitted('update:modelValue')).toEqual([['ahmed']])
    expect(m.emitted('search')).toEqual([['ahmed']])
    vi.advanceTimersByTime(500)
    expect(m.emitted('update:modelValue')).toHaveLength(1)
  })

  it('the clear button empties, refocuses and emits clear + search', async () => {
    const m = make({ modelValue: 'abc' })
    const clear = w!.get('button.clear')
    expect(clear.attributes('aria-label')).toBe('Clear search')
    await clear.trigger('click')
    expect(m.emitted('update:modelValue')!.at(-1)).toEqual([''])
    expect(m.emitted('clear')).toHaveLength(1)
    expect(m.emitted('search')!.at(-1)).toEqual([''])
    expect(document.activeElement).toBe(input().element)
    expect(w!.find('button.clear').exists()).toBe(false)
  })

  it('Esc clears when there is text and keeps the event from a surrounding dialog', async () => {
    const m = make({ modelValue: 'abc' })
    let reached = false
    const spy = () => (reached = true)
    document.body.addEventListener('keydown', spy)
    await input().trigger('keydown', { key: 'Escape' })
    expect(m.emitted('update:modelValue')!.at(-1)).toEqual([''])
    expect(reached).toBe(false)
    await input().trigger('keydown', { key: 'Escape' })
    expect(reached).toBe(true) // nothing to clear: Esc goes on
    document.body.removeEventListener('keydown', spy)
  })

  it('follows outside v-model changes', async () => {
    make({ modelValue: 'one' })
    await w!.setProps({ modelValue: 'two' })
    expect((input().element as HTMLInputElement).value).toBe('two')
  })

  it.each([
    ['text', 'search', undefined, 'search', 'Search'],
    ['email', 'field-mail', 'ltr', 'email', 'Search by email'],
    ['id', 'hash', 'ltr', 'search', 'Search by ID'],
  ])('kind %s swaps the icon and input behaviour', (kind, glyph, dir, inputmode, placeholder) => {
    make({ kind })
    expect(w!.get('.lead').attributes('name')).toBe(glyph)
    expect(input().attributes('dir')).toBe(dir)
    expect(input().attributes('inputmode')).toBe(inputmode)
    expect(input().attributes('placeholder')).toBe(placeholder)
    expect(input().attributes('aria-label')).toBe(placeholder)
    expect(input().attributes('type')).toBe('search')
  })

  it('disabled and error states; sizes', () => {
    make({ disabled: true, error: 'Bad', size: 'sm', modelValue: 'x' })
    expect(input().attributes('disabled')).toBeDefined()
    expect(input().attributes('aria-invalid')).toBe('true')
    expect(document.getElementById(input().attributes('aria-describedby')!)!.textContent).toBe('Bad')
    expect(w!.find('button.clear').exists()).toBe(false)
    expect(w!.classes()).toContain('size-sm')
  })
})
