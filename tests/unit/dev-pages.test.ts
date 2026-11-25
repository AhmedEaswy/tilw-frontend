import { describe, expect, it } from 'vitest'
import { withoutDevPages } from '~~/modules/dev-pages'

describe('dev-only pages module', () => {
  it('drops /dev and /dev/* routes and keeps the rest', () => {
    const pages = [{ path: '/' }, { path: '/dev' }, { path: '/dev/controls' }, { path: '/developer' }, { path: '/admin' }]
    expect(withoutDevPages(pages).map(p => p.path)).toEqual(['/', '/developer', '/admin'])
  })
})
