// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import UiDatePicker from '~/components/ui/UiDatePicker.vue'
import { uiGlobal } from './ui-mount'

let w: VueWrapper | null = null
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 25, 12))
})
afterEach(() => {
  w?.unmount()
  w = null
  vi.useRealTimers()
})

function make(props: Record<string, unknown> = {}, locale: 'en' | 'ar' = 'en') {
  w = mount(UiDatePicker, {
    props: { modelValue: null, 'onUpdate:modelValue': (v: unknown) => w!.setProps({ modelValue: v }), ...props },
    global: uiGlobal(locale),
    attachTo: document.body,
  })
  return w
}
const trigger = () => w!.get('button[role="combobox"]')
async function openCal() {
  await trigger().trigger('click')
  // flatpickr is imported on first open
  for (let i = 0; i < 20 && !w!.find('.flatpickr-calendar').exists(); i++) {
    await new Promise(r => setTimeout(r, 10))
    await flushPromises()
  }
  await flushPromises()
}
const day = (label: string) => w!.element.querySelector<HTMLElement>(`.flatpickr-day[aria-label="${label}"]`)!

describe('UiDatePicker', () => {
  it('has a combobox trigger that opens a labelled dialog', async () => {
    make()
    const t = trigger()
    expect(t.attributes('aria-haspopup')).toBe('dialog')
    expect(t.attributes('aria-expanded')).toBe('false')
    expect(t.text()).toBe('Pick a date')
    const dialog = w!.get('[role="dialog"]')
    expect(t.attributes('aria-controls')).toBe(dialog.attributes('id'))
    expect(dialog.attributes('aria-label')).toBe('Choose a date')
    expect(w!.find('.flatpickr-calendar').exists()).toBe(false) // lazy
    await openCal()
    expect(t.attributes('aria-expanded')).toBe('true')
    expect(w!.find('.flatpickr-calendar.inline').exists()).toBe(true)
  })

  it('shows the value as a localised date', () => {
    make({ modelValue: '2026-11-20' })
    expect(trigger().text()).toBe('20 Nov 2026')
  })

  it('picking a day emits YYYY-MM-DD and closes', async () => {
    const m = make()
    await openCal()
    day('November 21, 2026').click()
    await flushPromises()
    expect(m.emitted('update:modelValue')!.at(-1)).toEqual(['2026-11-21'])
    expect(m.emitted('change')!.at(-1)).toEqual(['2026-11-21'])
    expect(trigger().attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger().element)
  })

  it('respects min / max', async () => {
    make({ min: '2026-11-10', max: '2026-11-25' })
    await openCal()
    expect(day('November 9, 2026').classList.contains('flatpickr-disabled')).toBe(true)
    expect(day('November 26, 2026').classList.contains('flatpickr-disabled')).toBe(true)
    expect(day('November 10, 2026').classList.contains('flatpickr-disabled')).toBe(false)
  })

  it('range: two clicks emit { from, to }', async () => {
    const m = make({ mode: 'range' })
    expect(trigger().text()).toBe('Pick a date range')
    await openCal()
    day('November 3, 2026').click()
    await flushPromises()
    expect(m.emitted('update:modelValue')).toBeUndefined()
    day('November 12, 2026').click()
    await flushPromises()
    expect(m.emitted('update:modelValue')!.at(-1)).toEqual([{ from: '2026-11-03', to: '2026-11-12' }])
    expect(trigger().text()).toBe('3 Nov 2026 – 12 Nov 2026')
  })

  it('range presets set the range, clamped to min', async () => {
    const m = make({ mode: 'range', min: '2026-11-01' })
    await openCal()
    const presets = w!.findAll('.preset')
    expect(presets.map(p => p.text())).toEqual(['Last 7 days', 'Last 30 days', 'Last 90 days', 'This month'])
    await presets[0]!.trigger('click')
    expect(m.emitted('update:modelValue')!.at(-1)).toEqual([{ from: '2026-11-19', to: '2026-11-25' }])
    await openCal()
    await w!.findAll('.preset')[1]!.trigger('click')
    expect(m.emitted('update:modelValue')!.at(-1)).toEqual([{ from: '2026-11-01', to: '2026-11-25' }])
  })

  it('presets outside min/max are disabled', () => {
    make({ mode: 'range', max: '2026-01-01' })
    expect(w!.findAll('.preset').every(p => p.attributes('disabled') !== undefined)).toBe(true)
  })

  it('clear emits null', async () => {
    const m = make({ modelValue: '2026-11-20' })
    await w!.get('button.clear').trigger('click')
    expect(m.emitted('update:modelValue')!.at(-1)).toEqual([null])
  })

  it('Esc in the calendar closes, returns focus and does not reach a dialog', async () => {
    make()
    await openCal()
    let reached = false
    const spy = () => (reached = true)
    document.body.addEventListener('keydown', spy)
    w!.get('[role="dialog"]').element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    document.body.removeEventListener('keydown', spy)
    expect(trigger().attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger().element)
    expect(reached).toBe(false)
  })

  it('ArrowDown on the trigger opens the calendar', async () => {
    make()
    await trigger().trigger('keydown', { key: 'ArrowDown' })
    expect(trigger().attributes('aria-expanded')).toBe('true')
  })

  it('Arabic: Arabic month names, Saturday first, Arabic labels', async () => {
    make({ modelValue: '2026-11-20' }, 'ar')
    expect(trigger().text()).toBe('20 نوفمبر 2026')
    await openCal()
    expect(w!.get('.flatpickr-weekday').text()).toBe('سبت')
    expect(w!.get('.cur-month').text()).toContain('نوفمبر')
    expect(w!.get('[role="dialog"]').attributes('aria-label')).toBe('اختيار تاريخ')
  })

  it('RTL: ← moves to the next day and → to the previous one, across months', async () => {
    const host = document.createElement('div')
    host.style.direction = 'rtl'
    document.body.appendChild(host)
    w = mount(UiDatePicker, { props: { modelValue: '2026-11-30' }, global: uiGlobal('ar'), attachTo: host })
    await openCal()
    const focused = () => document.activeElement?.getAttribute('aria-label')
    const press = (key: string) => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    expect(focused()).toBe('نوفمبر 30, 2026')
    press('ArrowLeft')
    expect(focused()).toBe('ديسمبر 1, 2026')
    press('ArrowRight')
    press('ArrowRight')
    expect(focused()).toBe('نوفمبر 29, 2026')
    w.unmount()
    w = null
    host.remove()
  })

  it('disabled and error states', async () => {
    make({ disabled: true, error: 'Pick a date' })
    expect(trigger().attributes('disabled')).toBeDefined()
    expect(trigger().attributes('aria-invalid')).toBe('true')
    expect(document.getElementById(trigger().attributes('aria-describedby')!)!.textContent).toBe('Pick a date')
  })
})
