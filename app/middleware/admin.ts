/**
 * Admin console (feature 006): signed-out visitors go to sign-in (auth.global already did), anyone who is not an admin
 * goes to the library. The API answers "not found" to non-admins anyway, so nothing here says "you are not an admin".
 * For admins, the console's strings are loaded before the page renders (gaps G-D10).
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return
  const nuxtApp = useNuxtApp()
  const auth = useAuthStore()
  await auth.init()
  if (auth.status !== 'authed') return navigateTo({ path: '/signin', query: { next: to.fullPath } }, { replace: true })
  if (!auth.user?.isAdmin) return navigateTo('/app/scripts', { replace: true })
  await ensureAdminMessages(nuxtApp as never)
})
