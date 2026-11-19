export interface Toast {
  id: number
  text: string
  tone: 'success' | 'error' | 'info'
}

let seq = 0

/** App-wide toast queue. Feedback appears at the bottom and clears itself after a few seconds. */
export function useToast() {
  const toasts = useState<Toast[]>('toasts', () => [])

  function dismiss(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }
  function show(text: string, tone: Toast['tone'] = 'success', ms = 4000) {
    const id = ++seq
    toasts.value = [...toasts.value.slice(-2), { id, text, tone }]
    if (import.meta.client) setTimeout(() => dismiss(id), ms)
    return id
  }
  return { toasts, show, dismiss }
}
