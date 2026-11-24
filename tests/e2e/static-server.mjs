// Static host for the generated site, as a real host serves it: the file itself, then <path>/index.html (the
// prerendered page), then Nuxt's SPA fallback 200.html. `serve --single` sends every path to index.html, which
// breaks the prerendered pages (sign-in, privacy…) in the e2e run.
// Usage: node tests/e2e/static-server.mjs <root> <port>
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const [root = '.output/public', port = '3100'] = process.argv.slice(2)
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain', '.mp4': 'video/mp4', '.webm': 'video/webm',
}

async function file(p) {
  try {
    return (await stat(p)).isFile() ? p : null
  } catch {
    return null
  }
}

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^([/\\])+/, '')
  const base = join(root, path)
  if (!base.startsWith(normalize(root))) {
    res.writeHead(403).end()
    return
  }
  const hit = (await file(base)) ?? (await file(join(base, 'index.html'))) ?? join(root, '200.html')
  res.writeHead(200, { 'Content-Type': types[extname(hit)] ?? 'application/octet-stream' })
  res.end(await readFile(hit))
}).listen(Number(port), () => console.log(`static on http://localhost:${port}`))
