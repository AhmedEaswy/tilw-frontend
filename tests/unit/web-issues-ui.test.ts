// @vitest-environment happy-dom
/** Web issues that only show in what a component renders: the own-key card and the phone link history. */
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, onMounted, reactive, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import OwnKeyCard from '~/components/ai/OwnKeyCard.vue'
import LinkHistory from '~/components/link/LinkHistory.vue'
import { linkEndText } from '~/utils/link'
import { relativeTime } from '~/utils/relative'
import { uiGlobal } from './ui-mount'

const stubs = Object.fromEntries(
  ['UiButton', 'UiGlyph', 'UiSkeleton', 'SkeletonRegion', 'SkeletonRows', 'UiBanner', 'UiDialog', 'UiField', 'UiSelect', 'ProviderMark', 'AiMessage'].map(n => [n, true]),
)
// Auto-imports used in a template are read off the component instance, so they go in `mocks` as well.
const global = () => ({ ...uiGlobal(), stubs, mocks: { relativeTime } })

function stubNuxt(extra: Record<string, unknown>) {
  const all = { ref, computed, onMounted, useId, useI18n, relativeTime, linkEndText, ...extra }
  for (const [k, v] of Object.entries(all)) vi.stubGlobal(k, v)
}
afterEach(() => vi.unstubAllGlobals())

describe('own key card: a key the provider refused', () => {
  function card(checkOk: boolean) {
    // The API reports `usable` from the plan alone; `checkOk` says whether the provider accepts the key.
    const key = { capability: 'text', provider: 'anthropic', last4: '1234', checkOk, checkedAt: new Date().toISOString(), usable: true, reason: null }
    stubNuxt({
      useAiStore: () => reactive({ key, keyLoaded: true }),
      usePlanStore: () => ({ limit: () => true, isPro: true }),
      useUpgrade: () => ({ available: ref(false), open: () => {} }),
      useLimitError: () => ({ handle: () => false }),
      useToast: () => ({ show: () => {} }),
      useAiText: () => ({ errorCopy: () => null }),
    })
    return mount(OwnKeyCard, { global: global() })
  }

  it('does not promise that formatting uses no credits', () => {
    expect(card(false).text()).not.toContain('Formatting uses no credits')
  })
  it('still says so for a working key', () => {
    expect(card(true).text()).toContain('Formatting uses no credits')
  })
})

describe('phone link history', () => {
  const base = { scriptTitle: 'T', host: { kind: 'web', label: 'Chrome' }, lastUsedAt: new Date().toISOString(), pendingRemote: null, remote: null }

  it('does not show an ended link as waiting for a phone', async () => {
    const list = async () => [
      { ...base, id: 'a', state: 'ended', endReason: 'owner', endedAt: new Date().toISOString() },
      { ...base, id: 'b', state: 'waiting', endReason: null, endedAt: null },
    ]
    stubNuxt({ useServices: () => ({ links: { list } }), useErrorText: () => String, useLinkStore: () => ({}) })
    const w = mount(LinkHistory, { global: global() })
    await flushPromises()
    const [ended, waiting] = w.findAll('li').map(li => li.find('b').text())
    expect(ended).toBe('Phone link')
    expect(waiting).toBe('Waiting for a phone')
  })
})
