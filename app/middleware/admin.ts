/** Admin pages: anyone who is not an admin goes back to the library (the API would answer "not found" anyway). */
export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return
  const auth = useAuthStore()
  await auth.init()
  if (!auth.user?.isAdmin) return navigateTo('/app/scripts', { replace: true })
})
