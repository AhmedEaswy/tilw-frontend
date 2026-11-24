// Static host for the generated site, as a real host serves it: the file itself, then <path>/index.html (the
// prerendered page), then Nuxt's SPA fallback 200.html for client-rendered routes, else 404.html with a 404.
// `serve --single` sends every path to index.html, which breaks the prerendered pages (sign-in, privacy…) in the e2e run.
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

/** Routes rendered in the browser that have no prerendered file (routeRules ssr:false, dynamic pages). */
const SPA_ROUTES = [/^\/app(\/|$)/, /^\/confirm-email\/?$/, /^\/invite\/[^/]+\/?$/, /^\/remote\/?$/, /^\/__mock\/?$/]

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
  const found = (await file(base)) ?? (await file(join(base, 'index.html')))
  // Client-rendered routes get the SPA shell with 200 (the host rewrite the plan asks for); any other unknown path is
  // a real 404 with Nuxt's 404.html, which renders the error page in the browser.
  const spa = !found && SPA_ROUTES.some(r => `/${path.replace(/\\/g, '/')}`.match(r))
  const hit = found ?? join(root, spa ? '200.html' : '404.html')
  res.writeHead(found || spa ? 200 : 404, { 'Content-Type': types[extname(hit)] ?? 'application/octet-stream' })
  res.end(await readFile(hit))
}).listen(Number(port), () => console.log(`static on http://localhost:${port}`))
