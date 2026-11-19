/**
 * Reader keyboard map (US5, T064). Space plays/pauses, Esc closes the open panel, arrows move between
 * paragraphs (following the script direction) and Up/Down change the pace.
 * Keys typed into fields, and Space/Enter on a focused button, keep their normal behaviour.
 */
import type { Ref } from 'vue'

export interface ShortcutHandlers {
  toggle: () => void
  escape: () => void
  next: () => void
  prev: () => void
  faster?: () => void
  slower?: () => void
}

const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export function useShortcuts(handlers: ShortcutHandlers, opts: { direction: Ref<'rtl' | 'ltr'>; enabled?: Ref<boolean> }) {
  function onKey(e: KeyboardEvent) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
    if (opts.enabled && !opts.enabled.value) return
    const el = e.target as HTMLElement | null
    if (el && (TYPING.has(el.tagName) || el.isContentEditable)) return
    // Inside a dialog or settings panel only Esc is ours; everything else belongs to the controls there.
    if (el?.closest('dialog, [data-reader-panel]') && e.key !== 'Escape') return

    const rtl = opts.direction.value === 'rtl'
    switch (e.key) {
      case ' ':
      case 'Spacebar':
        if (el && (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'radio')) return
        handlers.toggle()
        break
      case 'Escape':
        handlers.escape()
        break
      case 'ArrowLeft':
        ;(rtl ? handlers.next : handlers.prev)()
        break
      case 'ArrowRight':
        ;(rtl ? handlers.prev : handlers.next)()
        break
      case 'ArrowUp':
        if (!handlers.faster) return
        handlers.faster()
        break
      case 'ArrowDown':
        if (!handlers.slower) return
        handlers.slower()
        break
      default:
        return
    }
    e.preventDefault()
  }

  onMounted(() => window.addEventListener('keydown', onKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
}
