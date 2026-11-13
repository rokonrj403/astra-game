import { writeFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

/**
 * M6 local checks, with motion ON (the other specs run with reduced motion):
 *  1. frame rate during the time-lapse and the rays reveal with the CPU slowed 4 times (a cheap phone),
 *  2. how long a whole Cadet mission takes for a person who thinks 3 to 5 seconds before each day.
 * Results go to e2e-shots/perf.json and the console; the test only fails on a truly broken frame rate or a mission that never ends.
 */
test.use({ reducedMotion: 'no-preference' })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.5
  })
  await page.route('**/DONKI-API/**', (r) => r.abort())
})

async function toPlay(page: Page, pause = 0) {
  await page.goto('./')
  await page.waitForTimeout(pause)
  await page.getByRole('button', { name: 'Play' }).click()
  await page.waitForTimeout(pause)
  await page.getByRole('button', { name: /Malapert Massif/ }).click()
  await page.getByRole('button', { name: 'Go' }).click()
  await page.waitForTimeout(pause)
  await page.getByRole('button', { name: /Cadet/ }).click()
}

async function give(page: Page, id: string, label: string, n: number) {
  for (let i = 0; i < n; i++) {
    if (!(await page.getByRole('button', { name: 'More blocks, ' + id }).isVisible())) await page.getByRole('button', { name: new RegExp('^' + label + ', [0-9]+ blocks?$') }).click()
    await page.getByRole('button', { name: 'More blocks, ' + id }).click()
  }
}

/** Plays one day's choices: blocks, a guess if asked, a card choice if there is one. */
async function decide(page: Page) {
  await give(page, 'air', 'Air', 3)
  await give(page, 'shield', 'Shield', 3)
  const ask = page.getByRole('group', { name: 'ORBI asks' })
  if (await ask.isVisible()) await ask.getByRole('button').nth(2).click()
  const opt = page.locator('.optbtn')
  if ((await opt.count()) > 0) await opt.first().click()
}

test('frame rate with the CPU slowed 4 times: time-lapse and rays reveal', async ({ page }) => {
  test.setTimeout(240_000)
  const client = await page.context().newCDPSession(page)
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.addInitScript(() => {
    const w = window as unknown as { __frames: number[]; __rec: boolean }
    w.__frames = []
    w.__rec = false
    const tick = (t: number) => {
      if (w.__rec) w.__frames.push(t)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await toPlay(page)
  const rows: { day: number; kind: string; fps: number; worstMs: number; over50: number; seconds: number }[] = []
  let day = 0
  for (let guard = 0; guard < 80; guard++) {
    if (await page.getByRole('heading', { name: /Mission complete|Rescue ship/ }).isVisible()) break
    if (await page.getByRole('group', { name: 'Why it happened' }).isVisible()) {
      await page.getByRole('button', { name: 'See my mission' }).click()
    } else if (await page.locator('.daysummary').isVisible()) {
      await page.getByRole('button', { name: /Next day|See what happened|Finish the mission/ }).click()
    } else if (await page.locator('.sc-tray').isVisible()) {
      await decide(page)
      day++
      await page.evaluate(() => {
        const w = window as unknown as { __frames: number[]; __rec: boolean }
        w.__frames = []
        w.__rec = true
      })
      await page.getByRole('button', { name: 'Next day' }).click()
      await page.locator('.daysummary').waitFor({ timeout: 30_000 })
      await page.waitForTimeout(2200) // the reveal on the summary: rays or all-clear
      const frames = await page.evaluate(() => {
        const w = window as unknown as { __frames: number[]; __rec: boolean }
        w.__rec = false
        return w.__frames
      })
      const deltas = frames.slice(1).map((t, i) => t - frames[i]!)
      const seconds = deltas.reduce((a, b) => a + b, 0) / 1000
      const storm = (await page.getByLabel('Real storm').count()) > 0
      rows.push({ day, kind: storm ? 'rays reveal' : 'time-lapse', fps: Math.round((deltas.length / seconds) * 10) / 10, worstMs: Math.round(Math.max(...deltas)), over50: deltas.filter((d) => d > 50).length, seconds: Math.round(seconds * 10) / 10 })
    } else await page.waitForTimeout(150)
  }
  writeFileSync('e2e-shots/perf.json', JSON.stringify(rows, null, 2))
  console.log('PERF 4x CPU throttle', JSON.stringify(rows))
  const mean = rows.reduce((a, r) => a + r.fps, 0) / Math.max(1, rows.length)
  console.log('PERF mean fps', Math.round(mean * 10) / 10)
  expect(rows.length, 'days measured').toBeGreaterThan(3)
  expect(mean, 'mean frame rate at 4x CPU slowdown').toBeGreaterThan(15)
})

test('frame rate of the Start screen loop with the CPU slowed 4 times (a full 8-second loop and the Play zoom)', async ({ page }) => {
  test.setTimeout(120_000)
  const client = await page.context().newCDPSession(page)
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.addInitScript(() => {
    const w = window as unknown as { __frames: number[] }
    w.__frames = []
    const tick = (t: number) => {
      w.__frames.push(t)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await page.goto('./')
  await expect(page.locator('.attract-scene')).toHaveAttribute('data-still', 'no')
  await page.waitForTimeout(500)
  await page.evaluate(() => ((window as unknown as { __frames: number[] }).__frames = []))
  await page.waitForTimeout(9000) // one whole loop: flare, rays, wave
  const loop = await page.evaluate(() => (window as unknown as { __frames: number[] }).__frames)
  await page.evaluate(() => ((window as unknown as { __frames: number[] }).__frames = []))
  // Tap from inside the page, so Playwright's own checks (slow with the CPU throttled) are not counted as dropped frames.
  await page.evaluate(() => (document.querySelector('button.primary.big') as HTMLButtonElement).click())
  await page.waitForTimeout(560) // the 600 ms camera move into the base, before the next screen mounts
  const zoom = await page.evaluate(() => (window as unknown as { __frames: number[] }).__frames)
  await page.locator('.polemap').first().waitFor()
  const stats = (frames: number[]) => {
    const d = frames.slice(1).map((t, i) => t - frames[i]!)
    const secs = d.reduce((a, b) => a + b, 0) / 1000
    return { fps: Math.round((d.length / secs) * 10) / 10, worstMs: Math.round(Math.max(...d)), over50ms: d.filter((x) => x > 50).length, seconds: Math.round(secs * 10) / 10 }
  }
  const result = { loop: stats(loop), playZoom560ms: stats(zoom) }
  writeFileSync('e2e-shots/perf-title.json', JSON.stringify(result, null, 2))
  console.log('PERF title 4x CPU throttle', JSON.stringify(result))
  expect(result.loop.fps, 'Start loop fps at 4x CPU slowdown').toBeGreaterThan(50)
})

test('a whole Cadet mission with 3 to 5 seconds of thinking per day', async ({ page }) => {
  test.setTimeout(420_000)
  const thinking = [3000, 4000, 5000, 3500, 4500, 3000, 5000, 4000, 3500, 4500]
  const t0 = Date.now()
  await toPlay(page, 2500) // reading the start, the map and the mode choice
  const days: number[] = []
  let day = 0
  let dayStart = Date.now()
  for (let guard = 0; guard < 900; guard++) {
    if (await page.getByRole('heading', { name: /Mission complete|Rescue ship/ }).isVisible()) break
    if (await page.getByRole('group', { name: 'Why it happened' }).isVisible()) {
      await page.waitForTimeout(4000) // looking at the three pictures
      await page.getByRole('button', { name: 'See my mission' }).click()
    } else if (await page.locator('.daysummary').isVisible()) {
      await page.waitForTimeout(2500) // reading the day's pictures
      days.push(Math.round((Date.now() - dayStart) / 100) / 10)
      await page.getByRole('button', { name: /Next day|See what happened|Finish the mission/ }).click()
      dayStart = Date.now()
    } else if (await page.locator('.sc-tray').isVisible()) {
      await page.waitForTimeout(thinking[day % thinking.length]!)
      await decide(page)
      day++
      await page.getByRole('button', { name: 'Next day' }).click()
    } else await page.waitForTimeout(150)
  }
  await expect(page.getByRole('heading', { name: /Mission complete|Rescue ship/ })).toBeVisible()
  const total = Math.round((Date.now() - t0) / 1000)
  const result = { totalSeconds: total, minutes: Math.round((total / 60) * 10) / 10, daysPlayed: days.length, secondsPerDay: days }
  writeFileSync('e2e-shots/playtime.json', JSON.stringify(result, null, 2))
  console.log('PLAYTIME', JSON.stringify(result))
})
