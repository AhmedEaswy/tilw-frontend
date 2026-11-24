/**
 * Route guard (FR-005).
 * - /app/** requires a session; otherwise go to /signin?next=<path>.
 * - Guest-only pages send signed-in users to the library.
 * Runs on the client only: the static build has no server session to check.
 */
const GUEST_ONLY = new Set(['/signin', '/signup', '/waitlist', '/forgot-password', '/forgot-password/sent'])

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return
  // Feature 006: the admin console needs a session too (the admin middleware then checks the flag).
  const needsAuth = to.path === '/app' || to.path.startsWith('/app/') || to.path === '/admin' || to.path.startsWith('/admin/')
  const guestOnly = GUEST_ONLY.has(to.path.replace(/\/$/, ''))
  if (!needsAuth && !guestOnly) return

  const auth = useAuthStore()
  const nuxtApp = useNuxtApp()

  // Guest pages are prerendered HTML. Redirecting while that HTML hydrates would mount the app
  // layout onto the auth layout's DOM, so wait until hydration has finished.
  if (guestOnly && nuxtApp.isHydrating && nuxtApp.payload.serverRendered) {
    onNuxtReady(async () => {
      await auth.init()
      if (auth.status === 'authed') await navigateTo('/app/scripts', { replace: true })
    })
    return
  }

  await auth.init()

  if (needsAuth && auth.status !== 'authed') {
    return navigateTo({ path: '/signin', query: to.fullPath !== '/app' ? { next: to.fullPath } : {} }, { replace: true })
  }
  if (guestOnly && auth.status === 'authed') {
    return navigateTo('/app/scripts', { replace: true })
  }
})
