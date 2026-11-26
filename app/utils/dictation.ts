/**
 * Where dictated words land in the script (gaps G-A7): they replace the selection (or go at the cursor), with a space
 * added on each side that needs one. The same placing draws the gray preview and makes the confirmed text.
 */
export function placeSpoken(body: string, at: { start: number; end: number }, words: string) {
  const start = Math.max(0, Math.min(at.start, body.length))
  const end = Math.max(start, Math.min(at.end, body.length))
  const clean = words.trim()
  const before = body.slice(0, start)
  const after = body.slice(clean ? end : start)
  const pre = clean && before && !/\s$/.test(before) ? ' ' : ''
  const post = clean && after && !/^\s/.test(after) ? ' ' : ''
  const insert = pre + clean + post
  return { start, end, insert, body: before + insert + after, caret: before.length + pre.length + clean.length }
}
