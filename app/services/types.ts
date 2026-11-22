/** Entities shared by the UI and the service ports. See specs/001-studio-frontend/data-model.md. */

export type Locale = 'ar' | 'en'
export type Theme = 'system' | 'light' | 'dark'
export type TextDirection = 'auto' | 'rtl' | 'ltr'

/** Account-wide reading settings (G15). Text direction is per script, not here. */
export interface ReadingSettings {
  mode: 'constant' | 'manual'
  wpm: number
  fontSize: 'S' | 'M' | 'L' | 'XL'
  mirror: boolean
  lineWidth: 'narrow' | 'medium' | 'wide'
  countdownSec: 0 | 3 | 5 | 10
}

export const DEFAULT_READING: ReadingSettings = {
  mode: 'constant',
  wpm: 120,
  fontSize: 'M',
  mirror: false,
  lineWidth: 'medium',
  countdownSec: 3,
}

export interface User {
  id: string
  name: string
  email: string
  locale: Locale
  theme: Theme
  reading: ReadingSettings
  /** Present when the real service is used; the mock has no admins. */
  isAdmin?: boolean
  createdAt: string
}

export interface DeliveryMark {
  id: string
  type: 'emphasis' | 'pause' | 'note'
  start: number
  end: number
  pauseSec?: number
  note?: string
}

export interface ReadingPosition {
  paragraph: number
  offset: number
}

export interface Script {
  id: string
  title: string
  body: string
  marks: DeliveryMark[]
  direction: TextDirection
  pinned: boolean
  archivedAt: string | null
  version: number
  createdAt: string
  updatedAt: string
  lastOpenedAt: string | null
  lastPosition: ReadingPosition | null
}

/** List rows omit the body; `excerpt` is the first line. */
export type ScriptSummary = Omit<Script, 'body' | 'marks'> & { excerpt: string; wordCount: number; paragraphCount: number }

export type ScriptPatch = Partial<Pick<Script, 'title' | 'body' | 'marks' | 'direction' | 'pinned' | 'archivedAt' | 'lastOpenedAt'>>

export interface LegacyScript {
  key: string
  title: string
  kind: 'draft' | 'saved'
  body: string
}

export type PortErrorCode =
  | 'invalid_credentials'
  | 'validation'
  | 'unauthenticated'
  | 'token_invalid'
  | 'token_expired'
  | 'conflict'
  | 'not_found'
  | 'rate_limited'
  | 'network'
  | 'unknown'

export class PortError extends Error {
  constructor(
    public code: PortErrorCode,
    public fields?: Record<string, string>,
    /** For `conflict`: the server copy. */
    public current?: unknown,
  ) {
    super(code)
    this.name = 'PortError'
  }
}

export const isPortError = (e: unknown, code?: PortErrorCode): e is PortError =>
  e instanceof PortError && (!code || e.code === code)
