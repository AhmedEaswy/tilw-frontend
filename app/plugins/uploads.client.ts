/**
 * Release 2 (US3): run the upload queue for whoever is signed in, whatever the layout. The recording studio uses the
 * `reader` layout, so starting it from the app layout alone left takes recorded after opening the studio directly
 * (or reloading it) out of auto sync.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const auth = useAuthStore()
  const uploads = useUploadsStore()
  watch(() => auth.user?.id, (id) => {
    void Promise.resolve(nuxtApp.runWithContext(() => (id ? uploads.start(id) : uploads.stop()))).catch(() => {})
  }, { immediate: true })
})
