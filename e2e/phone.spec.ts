import { expect, test, type Page } from '@playwright/test'

const W = 360

/**
 * Looks at the screen as a kid on a small phone would:
 *  - nothing makes the page scroll sideways or sticks out past the screen edge
 *  - no text is smaller than 14px (anything smaller needs zoom)
 *  - every button is at least 44px tall and wide
 * It also saves a screenshot to e2e-shots/ so a person can look.
 */
async function audit(page: Page, name: string) {
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `e2e-shots/${name}.png`, fullPage: true })
  const issues = await page.evaluate((width) => {
    const out: string[] = []
    for (const img of document.querySelectorAll('img')) if (!img.complete || img.naturalWidth === 0) out.push(`picture did not load: ${img.alt}`)
    if (document.documentElement.scrollWidth > width) out.push(`page scrolls sideways (${document.documentElement.scrollWidth}px wide)`)
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
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

async function toBase(page: Page, mode: 'Cadet' | 'Commander') {
  await page.goto('/')
  await page.getByRole('button', { name: 'Play' }).click()
  await audit(page, '02-place')
  await page.getByRole('button', { name: /Malapert Massif/ }).click()
  await audit(page, '03-mode')
  await page.getByRole('button', { name: new RegExp(mode) }).click()
}

test('every screen fits a 360x740 phone: setup, base, sun, cards, data', async ({ page }) => {
  await page.goto('/')
  await audit(page, '01-start')
  await toBase(page, 'Commander')
  await expect(page.getByText('Day 1 of 20')).toBeVisible()
  await audit(page, '04-base-day1')

  // One screen of scrolling: the longest base screen (Commander, Day 1, with a choice card) is at most 2 screens tall,
  // and "Next day" is on screen without scrolling.
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  expect(height, `base screen is ${height}px tall`).toBeLessThanOrEqual(1480)
  const next = await page.getByRole('button', { name: 'Next day' }).boundingBox()
  expect(next && next.y + next.height, 'Next day is visible without scrolling').toBeLessThanOrEqual(740)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const bottom = await page.getByRole('button', { name: 'Next day' }).boundingBox()
  expect(bottom && bottom.y + bottom.height, 'Next day stays visible at the bottom of the page').toBeLessThanOrEqual(740)
  await page.evaluate(() => window.scrollTo(0, 0))

  await page.getByRole('button', { name: 'More blocks for Air' }).click()
  await page.getByRole('button', { name: 'More blocks for Shield' }).click()
  await audit(page, '05-base-blocks')

  await page.getByRole('button', { name: /Today's Sun, SAVED/ }).click()
  await expect(page.locator('[data-status="SAVED"]')).toBeVisible()
  await audit(page, '06-sun-saved')
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByText('4 left')).toBeVisible() // the blocks were kept

  await page.getByRole('button', { name: /Data/ }).click()
  for (const s of await page.locator('summary').all()) await s.click()
  await audit(page, '07-data-open')
  await page.getByRole('button', { name: 'Back' }).click()

  await page.getByRole('button', { name: 'Next day' }).click()
  await audit(page, '08-report')
})

test('settings and for-teachers fit', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings' }).click()
  await audit(page, '15-settings')
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('button', { name: 'For teachers' }).click()
  for (const s of await page.locator('summary').all()) if (!(await s.evaluate((el) => (el.parentElement as HTMLDetailsElement).open))) await s.click()
  await audit(page, '16-teachers')
})

test('the storm, radio call, why-it-happened, end and card screens fit', async ({ page }) => {
  await toBase(page, 'Cadet')
  const seen = new Set<string>()
  for (let guard = 0; guard < 40; guard++) {
    if (await page.getByRole('heading', { name: /Mission complete|The rescue ship is here/ }).isVisible()) break
    if (await page.getByRole('heading', { name: 'Why it happened' }).isVisible()) {
      await audit(page, '12-why')
      await page.getByRole('button', { name: 'See my mission' }).click()
    } else if (await page.getByRole('button', { name: 'See what happened' }).isVisible()) {
      await page.getByRole('button', { name: 'See what happened' }).click()
    } else if (await page.getByRole('button', { name: 'Finish the mission' }).isVisible()) {
      await page.getByRole('button', { name: 'Finish the mission' }).click()
    } else if (await page.getByText('Share power', { exact: true }).first().isVisible()) {
      for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'More blocks for Air' }).click()
      for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'More blocks for Shield' }).click()
      const radio = page.getByRole('button', { name: 'More blocks for Radio' })
      if (await radio.isEnabled()) await radio.click()
      if (await page.getByRole('alert').isVisible()) {
        if (!seen.has('alert')) await audit(page, '09-base-storm-alert')
        seen.add('alert')
        if (!seen.has('now') && (await page.getByRole('alert').textContent())?.includes('Storm today')) {
          seen.add('now')
          await audit(page, '09b-base-storm-now')
        }
      }
      await page.getByRole('button', { name: 'Next day' }).click()
    } else {
      // A report screen. Audit the first one that shows a radio call and the first one that shows a real storm.
      if ((await page.getByLabel('Real storm').count()) > 0 && !seen.has('storm')) {
        seen.add('storm')
        await audit(page, '10-report-storm')
      }
      if ((await page.getByLabel('Radio call to Earth').count()) > 0 && !seen.has('radio')) {
        seen.add('radio')
        await page.waitForTimeout(2800) // the answer arrives after the radio delay
        await audit(page, '11-report-radio')
      }
      await page.getByRole('button', { name: /Next day|See what happened|Finish the mission/ }).click()
    }
  }
  await audit(page, '13-end')
  expect(seen.has('storm'), 'a real storm should have reached the base').toBe(true)
  await page.getByRole('button', { name: 'Play again' }).click()
  await page.getByRole('button', { name: 'My storm cards' }).click()
  await audit(page, '14-storm-cards')
})
