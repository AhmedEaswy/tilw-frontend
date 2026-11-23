/**
 * Helpers for showing and saving takes (US7). All of this stays in the browser.
 */
import type { TakeMeta } from '~/services/takes'

/** First-frame poster for a video take, made once and cached on the take's metadata. */
export function useTakePoster(meta: () => TakeMeta) {
  const poster = computed(() => meta().poster ?? null)
  const takes = useTakesStore()

  async function make() {
    const m = meta()
    if (m.kind !== 'video' || m.poster || !import.meta.client) return
    const take = await useTakesRepo().get(m.id)
    if (!take) return
    const url = URL.createObjectURL(take.blob)
    try {
      const data = await frameOf(url)
      if (data) await takes.setPoster(m.id, data)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  onMounted(() => void make().catch(() => {}))
  return poster
}

function frameOf(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    const done = (x: string | null) => {
      v.removeAttribute('src')
      v.load()
      resolve(x)
    }
    const timer = setTimeout(() => done(null), 5000)
    v.onloadeddata = () => {
      v.currentTime = Math.min(0.5, (v.duration && Number.isFinite(v.duration) ? v.duration : 1) / 2)
    }
    v.onseeked = () => {
      clearTimeout(timer)
      const w = 480
      const h = Math.round((v.videoHeight / Math.max(1, v.videoWidth)) * w) || 270
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const g = c.getContext('2d')
      if (!g) return done(null)
      // The preview was mirrored while recording; the file and its poster are not.
      g.drawImage(v, 0, 0, w, h)
      done(c.toDataURL('image/jpeg', 0.72))
    }
    v.onerror = () => {
      clearTimeout(timer)
      done(null)
    }
    v.src = url
  })
}

/** Start the browser download of the original file (FR-032). Resolves false when the take is gone. */
export async function downloadTake(meta: TakeMeta, word: string): Promise<boolean> {
  // Release 2: a Drive-only take downloads the original file from Drive.
  const blob = meta.driveOnly ? await useTakesStore().blobFor(meta.id) : (await useTakesRepo().get(meta.id))?.blob
  if (!blob) return false
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = takeFileName(meta.scriptTitle, meta.number, meta.mimeType, word)
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return true
}

/** "٢" in Arabic, "2" in English — the frames write take numbers with the UI's digits. */
export function useTakeNumber() {
  const { locale } = useI18n()
  const nf = computed(() => new Intl.NumberFormat(locale.value === 'ar' ? 'ar-u-nu-arab' : 'en'))
  return (n: number) => nf.value.format(n)
}
