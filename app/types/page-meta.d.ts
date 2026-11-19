declare module '#app' {
  interface PageMeta {
    /** Auth layout photograph: 'portrait' (default) or 'glass'. */
    authPhoto?: 'portrait' | 'glass'
    /** Auth layout back button target. */
    authBack?: string
  }
}

export {}
