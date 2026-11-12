import { describe, expect, it } from 'vitest'
import { bundledSun, loadSun } from './sun'
import type { KeyValue } from './store'

const NOW = new Date('2026-11-14T12:00:00Z')
const LINK = 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/1/-1'

const flare = (cls: string, peak: string, link = LINK) => ({ classType: cls, peakTime: peak, link })
const storm = (start: string, kps: number[]) => ({
  startTime: start,
  allKpIndex: kps.map((k) => ({ kpIndex: k })),
  link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/GST/2/-1',
})

function fakeFetch(flares: unknown, storms: unknown, status = 200): typeof fetch {
  return (async (url: string) => {
    const body = String(url).includes('/FLR?') ? flares : storms
    return { ok: status === 200, status, json: async () => body } as Response
  }) as unknown as typeof fetch
}
const failing: typeof fetch = (async () => {
  throw new Error('offline')
}) as unknown as typeof fetch

function memory(): KeyValue & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}

describe("Today's Sun labels", () => {
  it('is LIVE only when NASA answered just now with checked data', async () => {
    const v = await loadSun({
      now: NOW,
      store: memory(),
      fetchFn: fakeFetch([flare('C2.1', '2026-11-12T01:00Z'), flare('M1.0', '2026-11-13T08:00Z')], [storm('2026-11-10T00:00Z', [3, 5, 4])]),
    })
    expect(v.status).toBe('LIVE')
    expect(v.asOf).toBe(NOW.toISOString())
    expect(v.flares.map((f) => f.class)).toEqual(['M1.0', 'C2.1'])
    expect(v.magneticStorm?.kp).toBe(5)
  })

  it('a quiet week is LIVE with no flares, not a made-up list', async () => {
    const v = await loadSun({ now: NOW, store: memory(), fetchFn: fakeFetch([], []) })
    expect(v.status).toBe('LIVE')
    expect(v.flares).toEqual([])
    expect(v.magneticStorm).toBeNull()
  })

  it('no network gives SAVED with the bundled 12 Nov copy, never LIVE', async () => {
    const v = await loadSun({ now: NOW, store: memory(), fetchFn: failing })
    expect(v.status).toBe('SAVED')
    expect(v.asOf).toBe('2026-11-12')
    expect(v.flares.length).toBeGreaterThan(0)
    expect(v.source).toMatch(/DONKI archive pulled 2026-11-12/)
  })

  it('missing fetch gives SAVED', async () => {
    const saved = globalThis.fetch
    // @ts-expect-error simulate an old browser
    globalThis.fetch = undefined
    try {
      expect((await loadSun({ now: NOW, store: memory() })).status).toBe('SAVED')
    } finally {
      globalThis.fetch = saved
    }
  })

  const bad: [string, typeof fetch][] = [
    ['an HTTP error', fakeFetch([], [], 500)],
    ['a reply that is not a list', fakeFetch({ oops: true }, [])],
    ['a flare with a bad class', fakeFetch([flare('Z9', '2026-11-12T01:00Z')], [])],
    ['a flare that has not happened yet', fakeFetch([flare('M1.0', '2026-11-20T01:00Z')], [])],
    ['a link that is not a NASA DONKI page', fakeFetch([flare('M1.0', '2026-11-12T01:00Z', 'https://example.com/x')], [])],
    ['a storm with an impossible Kp', fakeFetch([], [storm('2026-11-10T00:00Z', [42])])],
  ]
  for (const [name, fn] of bad) {
    it(`falls back to SAVED on ${name}`, async () => {
      const v = await loadSun({ now: NOW, store: memory(), fetchFn: fn })
      expect(v.status).toBe('SAVED')
    })
  }

  it('an older live copy on this device is SAVED, with its own date', async () => {
    const store = memory()
    await loadSun({ now: new Date('2026-11-13T09:00:00Z'), store, fetchFn: fakeFetch([flare('M2.0', '2026-11-13T07:00Z')], []) })
    const later = await loadSun({ now: NOW, store, fetchFn: failing })
    expect(later.status).toBe('SAVED')
    expect(later.asOf).toBe('2026-11-13T09:00:00.000Z')
    expect(later.flares[0]?.class).toBe('M2.0')
  })

  it('a device copy older than the bundled one is ignored', async () => {
    const store = memory()
    store.setItem('astra-sun-v1', JSON.stringify({ status: 'LIVE', asOf: '2026-01-01T00:00:00.000Z', windowDays: 7, flares: [], magneticStorm: null, source: 'old' }))
    const v = await loadSun({ now: NOW, store, fetchFn: failing })
    expect(v.asOf).toBe('2026-11-12')
  })

  it('broken storage does not break loading', async () => {
    const broken: KeyValue = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect((await loadSun({ now: NOW, store: broken, fetchFn: fakeFetch([], []) })).status).toBe('LIVE')
    expect((await loadSun({ now: NOW, store: broken, fetchFn: failing })).status).toBe('SAVED')
  })

  it('the bundled copy is always SAVED', () => {
    expect(bundledSun().status).toBe('SAVED')
  })
})
