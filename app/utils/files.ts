/** TXT import/export and browser download helpers (FR-011, G11). */

export const IMPORT_MAX_BYTES = 1_000_000

export type ImportError = 'type' | 'empty' | 'size' | 'read'

export async function readTextFile(file: File): Promise<{ title: string; body: string } | { error: ImportError }> {
  const isText = file.type === 'text/plain' || /\.txt$/i.test(file.name)
  if (!isText) return { error: 'type' }
  if (file.size > IMPORT_MAX_BYTES) return { error: 'size' }
  let text: string
  try {
    text = await file.text()
  } catch {
    return { error: 'read' }
  }
  const body = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim()
  if (!body) return { error: 'empty' }
  return { title: titleFromFileName(file.name), body }
}

/** Trigger a browser download for a Blob. Returns the file name used. */
export function downloadBlob(blob: Blob, fileName: string): string {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return fileName
}

export function safeFileName(title: string, ext: string): string {
  const base = title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'tilw'
  return `${base}.${ext}`
}

export function downloadText(title: string, body: string): string {
  return downloadBlob(new Blob([`﻿${body}`], { type: 'text/plain;charset=utf-8' }), safeFileName(title, 'txt'))
}
