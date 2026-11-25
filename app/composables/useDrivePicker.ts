/**
 * "New from audio" → From Google Drive: Google's own Picker, in the browser. The person picks an audio file from their
 * Drive; with the drive.file grant Tilw already has, picking it is what gives the app access to that one file. The file
 * is then downloaded straight from Google into this browser and checked like a local one, so the audio never passes
 * through Tilw's servers (constitution IV).
 *
 * The access token is the short-lived one the uploader uses (StoragePort.uploadToken); the long-lived grant stays on
 * the service. Mock mode has no Google: it "picks" a short generated recording so the flow can be tried and tested.
 */

/** What the Picker returns for the chosen file. */
export interface DriveAudioDoc {
  id: string
  name: string
  mimeType: string
  /** Bytes, when Drive reports it (lets the size be checked before downloading). */
  sizeBytes: number | null
}

/** Audio types offered in the Picker (it doesn't take wildcards). */
const AUDIO_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/wav', 'audio/x-wav',
  'audio/wave', 'audio/webm', 'audio/ogg', 'audio/opus', 'audio/flac', 'audio/x-flac', 'audio/amr', 'audio/3gpp',
]

export class DrivePickerError extends Error {
  constructor(public readonly reason: 'unavailable' | 'download') {
    super(reason)
  }
}

let gapiLoad: Promise<void> | null = null
/** apis.google.com/js/api.js, then the `picker` module; loaded once, the first time someone opens the Picker. */
function loadPickerApi(): Promise<void> {
  gapiLoad ??= new Promise<void>((resolve, reject) => {
    const ready = () => (window as unknown as { gapi: { load: (m: string, o: { callback: () => void; onerror: () => void }) => void } })
      .gapi.load('picker', { callback: () => resolve(), onerror: () => reject(new DrivePickerError('unavailable')) })
    if ((window as unknown as { gapi?: unknown }).gapi) return ready()
    const s = document.createElement('script')
    s.src = 'https://apis.google.com/js/api.js'
    s.async = true
    s.onload = ready
    s.onerror = () => reject(new DrivePickerError('unavailable'))
    document.head.appendChild(s)
  }).catch((e) => {
    gapiLoad = null
    throw e
  })
  return gapiLoad
}

/** A short silent WAV, standing in for a Drive file in mock mode. */
function mockWav(seconds = 3, rate = 8000): Blob {
  const samples = seconds * rate
  const buf = new ArrayBuffer(44 + samples * 2)
  const v = new DataView(buf)
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); v.setUint32(4, 36 + samples * 2, true); str(8, 'WAVE'); str(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data')
  v.setUint32(40, samples * 2, true)
  return new Blob([buf], { type: 'audio/wav' })
}

export function useDrivePicker() {
  const config = useRuntimeConfig()
  const storage = useStorageStore()
  const { locale } = useI18n()
  const mock = config.public.servicesMode === 'mock'
  const apiKey = String(config.public.googlePickerApiKey || '')
  const appId = String(config.public.googleAppId || '')

  /** The service is set up for the Picker (mock mode always is). */
  const configured = mock || (!!apiKey && !!appId)
  /** Ready to pick: set up, and this person's Drive is linked. */
  const available = computed(() => configured && storage.linked)

  async function token() {
    return (await useServices().storage.uploadToken(null)).accessToken
  }

  /** Opens the Picker; resolves with the chosen file, or null when it was closed without one. */
  async function pick(): Promise<DriveAudioDoc | null> {
    if (mock) return { id: 'mock-drive-audio', name: 'Drive interview.wav', mimeType: 'audio/wav', sizeBytes: 44 + 3 * 8000 * 2 }
    if (!configured) throw new DrivePickerError('unavailable')
    const [accessToken] = await Promise.all([token(), loadPickerApi()])
    const g = (window as unknown as { google: { picker: Record<string, any> } }).google.picker
    return await new Promise<DriveAudioDoc | null>((resolve) => {
      const view = new g.DocsView(g.ViewId.DOCS).setMimeTypes(AUDIO_TYPES.join(',')).setIncludeFolders(true).setSelectFolderEnabled(false)
      const picker = new g.PickerBuilder()
        .addView(view)
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        .setAppId(appId)
        .setLocale(locale.value === 'ar' ? 'ar' : 'en')
        .setOrigin(window.location.origin)
        .setCallback((data: Record<string, any>) => {
          const action = data[g.Response.ACTION]
          if (action === g.Action.PICKED) {
            const d = data[g.Response.DOCUMENTS]?.[0] ?? {}
            const size = Number(d[g.Document.SIZE_BYTES] ?? d.sizeBytes)
            resolve({
              id: String(d[g.Document.ID] ?? d.id),
              name: String(d[g.Document.NAME] ?? d.name ?? 'audio'),
              mimeType: String(d[g.Document.MIME_TYPE] ?? d.mimeType ?? ''),
              sizeBytes: Number.isFinite(size) && size > 0 ? size : null,
            })
          } else if (action === g.Action.CANCEL) {
            resolve(null)
          }
        })
        .build()
      picker.setVisible(true)
    })
  }

  /** Downloads the picked file into this browser (never through Tilw). */
  async function download(doc: DriveAudioDoc): Promise<File> {
    if (mock) return new File([mockWav()], doc.name, { type: doc.mimeType })
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(doc.id)}?alt=media`, {
        headers: { Authorization: `Bearer ${await token()}` },
      })
      if (!res.ok) throw new DrivePickerError('download')
      const blob = await res.blob()
      return new File([blob], doc.name, { type: doc.mimeType || blob.type })
    } catch (e) {
      throw e instanceof DrivePickerError ? e : new DrivePickerError('download')
    }
  }

  return { configured, available, pick, download }
}
