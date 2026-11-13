import { writeFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const W = 360

/** Visible words on the screen (or inside `selector`): text that is shown, not hidden and not aria-hidden. Numbers count as words. */
async function countWords(page: Page, selector = 'main'): Promise<number> {
  return page.evaluate((sel) => {
    // A screen opened over the base screen leaves the base mounted but hidden, so look at every match and skip what is hidden.
    let n = 0
    for (const root of document.querySelectorAll(sel)) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const el = node.parentElement
        if (!el || el.closest('[aria-hidden="true"], [hidden], .sr')) continue // .sr = text for screen readers only, not shown
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden') continue
        n += (node.textContent ?? '').trim().split(/\s+/).filter(Boolean).length
      }
    }
    return n
  }, selector)
}

// HARD RULE for children's screens: at most 12 visible words (numbers count). Screens not listed here are adult pages or still to convert.
const BUDGET: Record<string, number> = {
  '01-start': 12,
  '02-place': 12,
  '03-mode': 12,
  '04-base-day1': 12,
  '04b-tour-dome': 12,
  '05-base-blocks': 12,
  '06-sun-saved': 12,
  '09-play-guess': 12,
  '09b-play-clue-tags': 12,
  '09b-play-storm': 12,
  '08-report': 12,
  '10-report-storm': 12,
  '11-report-radio': 12,
  '12-why': 12,
  '13-end': 12,
  '14-storm-cards': 400,
  '17-journal': 12,
}

const SHOTS = process.env.ASTRA_SHOTS ?? 'e2e-shots' // live runs use e2e-shots/live
// The word count of every screen the phone check visits, written to e2e-shots/words.json for the string audit.
const wordLog: { screen: string; words: number }[] = []
test.afterAll(() => {
  try {
    writeFileSync(`${SHOTS}/words.json`, JSON.stringify(wordLog, null, 2))
  } catch {
    /* the folder only exists after a run */
  }
})

/**
 * Looks at the screen as a kid on a small phone would:
 *  - nothing makes the page scroll sideways or sticks out past the screen edge
 *  - no text is smaller than 14px (anything smaller needs zoom)
 *  - every button is at least 44px tall and wide
 * It also saves a screenshot to e2e-shots/ so a person can look.
 */
// Child screens must not leave the bottom of the phone empty: the lowest thing on screen reaches at least 75% of the 740 px height.
const FILLS = new Set(['01-start', '02-place', '03-mode', '04-base-day1', '05-base-blocks', '08-report', '09-play-guess', '10-report-storm', '12-why', '13-end'])

async function audit(page: Page, name: string) {
  await page.waitForLoadState('networkidle')
  const words = await countWords(page)
  wordLog.push({ screen: name, words })
  const key = name.replace(/-cmd$/, '') // Commander frames use the same budgets as the Cadet ones
  if (BUDGET[key] !== undefined) expect(words, `${name} has ${words} visible words`).toBeLessThanOrEqual(BUDGET[key])
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
  if (FILLS.has(key)) {
    const lowest = await page.evaluate(() => {
      let max = 0
      for (const el of document.querySelectorAll<HTMLElement>('main *')) {
        if (el.closest('[hidden]')) continue
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden') continue
        const b = el.getBoundingClientRect()
        if (b.width > 0 && b.height > 0) max = Math.max(max, b.bottom + window.scrollY)
      }
      return max
    })
    expect(lowest, `${name}: content ends at ${Math.round(lowest)} px of 740 (more than a quarter of the phone is empty)`).toBeGreaterThanOrEqual(555)
  }
  const issues = await page.evaluate((width) => {
    const out: string[] = []
    for (const img of document.querySelectorAll('img')) if (!img.complete || img.naturalWidth === 0) out.push(`picture did not load: ${img.alt}`)
    if (document.documentElement.scrollWidth > width) out.push(`page scrolls sideways (${document.documentElement.scrollWidth}px wide)`)
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      if (el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg') continue // parts of a picture are clipped by it
      const b = el.getBoundingClientRect()
      if (b.width === 0 || b.height === 0) continue
      const label = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} "${(el.textContent ?? '').trim().slice(0, 28)}"`
      if (b.right > width + 0.5 || b.left < -0.5) out.push(`sticks out of the screen: ${label} (${Math.round(b.left)} to ${Math.round(b.right)})`)
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0)
      if (ownText && parseFloat(cs.fontSize) < 14) out.push(`text too small (${cs.fontSize}): ${label}`)
      // A single word that is taller than one line has been broken in the middle ("sam" / "e").
      for (const node of el.childNodes) {
        const word = (node.textContent ?? '').trim()
        if (node.nodeType !== 3 || word.length < 2 || /\s/.test(word)) continue
        const range = document.createRange()
        range.selectNodeContents(node)
        const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top)))
        if (lines.size > 1) out.push(`word broken across lines: ${label}`)
      }
      if (el.matches('button, summary') && (b.height < 44 || b.width < 44)) out.push(`tap target too small (${Math.round(b.width)}x${Math.round(b.height)}): ${label}`)
    }
    return out
  }, W)
  expect(issues, `${name}: ${issues.join(' | ')}`).toEqual([])
}

test.beforeEach(async ({ page }) => {
  // Fixed game seed, and NASA unreachable, so every run sees the same screens and Today's Sun says SAVED.
  await page.addInitScript(() => {
    Math.random = () => 0.5
  })
  await page.route('**/DONKI-API/**', (r) => r.abort())
})

/** Put n power blocks on a building: tap it, then its + sign. */
async function give(page: Page, id: string, label: string, n = 1) {
  const building = page.getByRole('button', { name: new RegExp('^' + label + ', [0-9]+ blocks?$') })
  const more = page.getByRole('button', { name: 'More blocks, ' + id })
  for (let i = 0; i < n; i++) {
    if (!(await more.isVisible())) await building.click()
    await more.click()
  }
}

async function toBase(page: Page, mode: 'Cadet' | 'Commander') {
  await page.goto('./')
  await page.getByRole('button', { name: 'Play' }).click()
  await audit(page, '02-place')
  await page.getByRole('button', { name: /Malapert Massif/ }).click()
  await page.getByRole('button', { name: 'Go' }).click()
  await audit(page, '03-mode')
  await page.getByRole('button', { name: new RegExp(mode) }).click()
}

test('every screen fits a 360x740 phone: setup, base, sun, cards, data', async ({ page }) => {
  await page.goto('./')
  await audit(page, '01-start')
  await page.getByRole('button', { name: 'More' }).click() // the adult pages sit behind one small gear
  await expect(page.getByRole('dialog', { name: 'More' })).toBeVisible()
  for (const n of ['Today’s Sun', 'My storm cards', 'Where the data comes from', 'For teachers', 'Settings']) await expect(page.getByRole('button', { name: n })).toBeVisible()
  await audit(page, '01b-start-gear')
  await page.getByRole('button', { name: 'Close' }).click()
  await toBase(page, 'Commander')
  await expect(page.getByLabel('Day 1 of 20')).toBeVisible()
  await audit(page, '04-base-day1')

  // The play screen is ONE screen: the scene, bars, power tray and Next all fit 740px at 360 wide, with no scrolling.
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  expect(height, `play screen is ${height}px tall`).toBeLessThanOrEqual(740)
  const next = await page.getByRole('button', { name: 'Next day' }).boundingBox()
  expect(next && next.y + next.height, 'Next day is visible without scrolling').toBeLessThanOrEqual(740)
  const tray = await page.locator('.sc-tray').boundingBox()
  expect(tray && tray.y, 'the power tray is in the lower half (thumb zone)').toBeGreaterThan(370)

  await give(page, 'air', 'Air')
  await audit(page, '04b-tour-dome') // ORBI's paw now points at the dome
  await give(page, 'shield', 'Shield')
  await audit(page, '05-base-blocks') // and now at Next

  await page.getByRole('button', { name: /Today's Sun, SAVED/ }).click()
  await expect(page.locator('[data-status="SAVED"]')).toBeVisible()
  await audit(page, '06-sun-saved')
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.locator('.sc-tray')).toHaveAttribute('data-blocks', '4') // the blocks were kept

  await page.getByRole('button', { name: /Data/ }).click()
  for (const s of await page.locator('summary').all()) await s.click()
  await audit(page, '07-data-open')
  await page.getByRole('button', { name: 'Back' }).click()

  await page.getByRole('button', { name: 'Next day' }).click()
  await page.locator('.daysummary').waitFor()
  await audit(page, '08-report')
})

test('the Flare Journal fits the phone and is stickers, not sentences', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Flare Journal' }).click()
  await expect(page.getByRole('heading', { name: 'Flare Journal' })).toBeVisible()
  await audit(page, '17-journal')
  expect(await countWords(page), 'journal words').toBeLessThanOrEqual(12)
  await page.getByRole('button', { name: 'No gas cloud' }).click()
  await page.locator('.sticker button').first().click()
  await audit(page, '18-journal-filtered')
})

test('settings and for-teachers fit', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'More' }).click()
  await page.getByRole('button', { name: 'Settings' }).click()
  await audit(page, '15-settings')
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('button', { name: 'More' }).click()
  await page.getByRole('button', { name: 'For teachers' }).click()
  for (const s of await page.locator('summary').all()) if (!(await s.evaluate((el) => (el.parentElement as HTMLDetailsElement).open))) await s.click()
  await audit(page, '16-teachers')
})


/** The lowest visible thing on the page reaches at least 75% of the 740 px phone (no more than a quarter empty). */
async function fills(page: Page, what: string) {
  const lowest = await page.evaluate(() => {
    let max = 0
    for (const el of document.querySelectorAll<HTMLElement>('main *')) {
      if (el.closest('[hidden]')) continue
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const b = el.getBoundingClientRect()
      if (b.width > 0 && b.height > 0) max = Math.max(max, b.bottom + window.scrollY)
    }
    return max
  })
  expect(lowest, `${what}: content ends at ${Math.round(lowest)} px of 740`).toBeGreaterThanOrEqual(555)
}

for (const mode of ['Cadet', 'Commander'] as const) {
test(`a full ${mode} mission: every day, storm, radio call, why, end and card screens fit`, async ({ page }) => {
  test.setTimeout(180_000)
  const sfx = mode === 'Commander' ? '-cmd' : ''
  await toBase(page, mode)
  const seen = new Set<string>()
  let days = 0
  for (let guard = 0; guard < 600; guard++) {
    if (await page.getByRole('heading', { name: /Mission complete|Rescue ship/ }).isVisible()) break
    if (await page.getByRole('group', { name: 'Why it happened' }).isVisible()) {
      await audit(page, `12-why${sfx}`)
      await page.getByRole('button', { name: 'See my mission' }).click()
    } else if (await page.locator('.daysummary').isVisible()) {
      // The summary after a day. Audit the first one that shows a real storm and the first that shows a radio call.
      // EVERY summary, storm days and reveal days included, fits the phone: no scrolling, Next on screen.
      const h = await page.evaluate(() => document.documentElement.scrollHeight)
      expect(h, 'a day summary is taller than the 740 px phone').toBeLessThanOrEqual(740)
      await fills(page, 'day summary')
      days++
      if ((await page.getByLabel('Real storm').count()) > 0 && !seen.has('storm')) {
        seen.add('storm')
        await audit(page, `10-report-storm${sfx}`)
      }
      if ((await page.getByLabel('Radio call to Earth').count()) > 0 && !seen.has('radio')) {
        seen.add('radio')
        await page.waitForTimeout(2800) // the answer arrives after the radio delay
        await audit(page, `11-report-radio${sfx}`)
      }
      await page.getByRole('button', { name: /Next day|See what happened|Finish the mission/ }).click()
    } else if (await page.locator('.sc-tray').isVisible()) {
      // Commander needs plants and a bigger shield to last all 20 days; Cadet keeps the simple split.
      await give(page, 'air', 'Air', mode === 'Commander' ? 2 : 3)
      if (mode === 'Commander') await give(page, 'plants', 'Plants', 1)
      await give(page, 'shield', 'Shield', mode === 'Commander' ? 3 : 2)
      if (await page.getByRole('group', { name: 'ORBI asks' }).isVisible()) {
        if (!seen.has('guess')) await audit(page, `09-play-guess${sfx}`)
        seen.add('guess')
        if (mode === 'Commander' && !seen.has('tags')) {
          // The flare's clue tags (class, cloud, and the side of the Sun as a half-lit disc) stay inside the 12 words.
          seen.add('tags')
          await page.getByRole('button', { name: 'Sun, flare clues' }).click()
          await audit(page, `09b-play-clue-tags${sfx}`)
          await page.getByRole('button', { name: 'Sun, flare clues' }).click()
        }
      }
      // The play screen stays inside the phone on every day, whatever card, flare or tag it has, and is not left empty.
      expect(await page.evaluate(() => document.documentElement.scrollHeight), 'play screen height').toBeLessThanOrEqual(740)
      await fills(page, 'play screen')
      if (mode === 'Commander') await expect(page.getByRole('meter', { name: 'Food' }), 'Commander shows the food bar every day').toBeVisible()
      const shown = await page.evaluate(() => [...document.querySelectorAll('main')].filter((m) => !m.closest('[hidden]')).map((m) => (m as HTMLElement).innerText.replace(/\s+/g, ' ')).join(' | '))
      expect(await countWords(page), `visible words on a play screen: ${shown}`).toBeLessThanOrEqual(12)
      await page.getByRole('button', { name: 'Next day' }).click()
    } else {
      await page.waitForTimeout(150) // the time-lapse is playing
    }
  }
  expect(days, `${mode} days played`).toBeGreaterThanOrEqual(mode === 'Commander' ? 10 : 5)
  await audit(page, `13-end${sfx}`)
  expect(seen.has('storm'), 'a real storm should have reached the base').toBe(true)
  await page.getByRole('button', { name: 'Play again' }).click()
  await page.getByRole('button', { name: 'More' }).click()
  await page.getByRole('button', { name: 'My storm cards' }).click()
  await audit(page, `14-storm-cards${sfx}`)
})
}
