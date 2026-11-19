declare module '#app' {
  interface PageMeta {
    /** Auth layout photograph: 'portrait' (default) or 'glass'. */
    authPhoto?: 'portrait' | 'glass'
    /** Auth layout back button target. */
    authBack?: string
    /** App layout on phones: hide the header and tab bar (full-screen editor, 6:21). */
    phoneMinimal?: boolean
  }
}

export {}
