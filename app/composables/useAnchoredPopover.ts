/**
 * A popup (listbox, calendar) anchored under a control. It is shown in the top layer with the Popover API when the
 * browser has it, so it escapes `overflow: hidden` parents and sits above a modal <dialog> the control lives in; the
 * element stays in the control's DOM, so a modal dialog doesn't make it inert. Without the Popover API it falls back
 * to `position: fixed` with the same coordinates.
 *
 * Placement: below the anchor, flipped above when there is more room there; aligned to the anchor's inline-start
 * edge (the right edge in RTL); kept inside the viewport. Repositions on scroll and resize while open.
 */
import { nextTick, onBeforeUnmount, ref, type Ref } from 'vue'

export interface AnchoredPopoverOptions {
  /** Make the popup at least as wide as the anchor (default true). */
  matchWidth?: boolean
  /** Gap between anchor and popup in px (default 4). */
  gap?: number
  /** Called on a pointerdown outside `root` while open (default: close). */
  onOutside?: () => void
}

const MARGIN = 8

export function useAnchoredPopover(
  root: Ref<HTMLElement | null | undefined>,
  anchor: Ref<HTMLElement | null | undefined>,
  pop: Ref<HTMLElement | null | undefined>,
  options: AnchoredPopoverOptions = {},
) {
  const open = ref(false)
  const placement = ref<'bottom' | 'top'>('bottom')

  function position() {
    const a = anchor.value
    const p = pop.value
    if (!a || !p || typeof window === 'undefined') return
    const r = a.getBoundingClientRect()
    const vw = window.innerWidth || document.documentElement.clientWidth
    const vh = window.innerHeight || document.documentElement.clientHeight
    const gap = options.gap ?? 4
    const rtl = getComputedStyle(a).direction === 'rtl'
    p.style.position = 'fixed'
    p.style.margin = '0'
    p.style.inset = 'auto'
    if (options.matchWidth !== false) p.style.minWidth = `${Math.round(r.width)}px`
    const below = vh - r.bottom - gap - MARGIN
    const above = r.top - gap - MARGIN
    // Measure with no height cap first, then cap to the side it goes on.
    p.style.maxHeight = ''
    const ph = p.offsetHeight
    const pw = p.offsetWidth
    const up = ph > below && above > below
    placement.value = up ? 'top' : 'bottom'
    const room = Math.max(120, up ? above : below)
    p.style.maxHeight = `${Math.floor(room)}px`
    const h = Math.min(ph, room)
    const top = up ? r.top - gap - h : r.bottom + gap
    let left = rtl ? r.right - pw : r.left
    left = Math.max(MARGIN, Math.min(left, vw - pw - MARGIN))
    p.style.top = `${Math.round(top)}px`
    p.style.left = `${Math.round(left)}px`
  }

  function onPointerDown(e: PointerEvent | MouseEvent) {
    const t = e.target as Node | null
    if (t && root.value?.contains(t)) return
    if (options.onOutside) options.onOutside()
    else hide()
  }
  function onViewport() {
    position()
  }

  function listen(on: boolean) {
    if (typeof window === 'undefined') return
    const m = on ? 'addEventListener' : 'removeEventListener'
    document[m]('pointerdown', onPointerDown as EventListener, true)
    window[m]('resize', onViewport)
    window[m]('scroll', onViewport, true)
  }

  async function show() {
    if (open.value) return
    open.value = true
    await nextTick()
    const p = pop.value as (HTMLElement & { showPopover?: () => void }) | null | undefined
    if (p?.showPopover && p.hasAttribute('popover')) {
      try {
        if (!p.matches(':popover-open')) p.showPopover()
      } catch {
        /* not connected or unsupported: the fixed fallback still works */
      }
    }
    position()
    listen(true)
  }

  function hide() {
    if (!open.value) return
    const p = pop.value as (HTMLElement & { hidePopover?: () => void }) | null | undefined
    try {
      if (p?.hidePopover && p.matches(':popover-open')) p.hidePopover()
    } catch {
      /* ignore */
    }
    open.value = false
    listen(false)
  }

  onBeforeUnmount(() => listen(false))

  return { open, placement, show, hide, position }
}
