import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * Automated accessibility scan (axe-core, WCAG 2 A and AA rules) of every child screen. Serious and critical findings fail the test.
 * It cannot replace a person with a screen reader, but it catches missing names, bad contrast, wrong roles and focus traps.
 */
const found: { screen: string; id: string; impact: string; nodes: number }[] = []

async function scan(page: Page, name: string) {
  await page.waitForLoadState('networkidle')
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  for (const v of result.violations) found.push({ screen: name, id: v.id, impact: v.impact ?? 'unknown', nodes: v.nodes.length })
  const bad = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(
    bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`),
    `${name}: serious or critical accessibility findings`,
  ).toEqual([])
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.5
  })
  await page.route('**/DONKI-API/**', (r) => r.abort())
})

test('every child screen passes the axe scan', async ({ page }) => {
  await page.goto('./')
  await scan(page, 'start')
  await page.getByRole('button', { name: 'Play' }).click()
  await scan(page, 'place')
  await page.getByRole('button', { name: /Malapert Massif/ }).click()
  await scan(page, 'place-picked')
  await page.getByRole('button', { name: 'Go' }).click()
  await scan(page, 'mode')
  await page.getByRole('button', { name: /Cadet/ }).click()
  await scan(page, 'play-day1-tour')

  const seen = new Set<string>()
  for (let guard = 0; guard < 80; guard++) {
    if (await page.getByRole('heading', { name: /Mission complete|Rescue ship/ }).isVisible()) break
    if (await page.getByRole('group', { name: 'Why it happened' }).isVisible()) {
      if (!seen.has('why')) await scan(page, 'why')
      seen.add('why')
      await page.getByRole('button', { name: 'See my mission' }).click()
    } else if (await page.locator('.daysummary').isVisible()) {
      if (!seen.has('summary')) await scan(page, 'day-summary')
      seen.add('summary')
      if ((await page.getByLabel('Real storm').count()) > 0 && !seen.has('storm')) {
        seen.add('storm')
        await scan(page, 'day-summary-storm')
      }
      await page.getByRole('button', { name: /Next day|See what happened|Finish the mission/ }).click()
    } else if (await page.locator('.sc-tray').isVisible()) {
      for (const [label, id, n] of [['Air', 'air', 3], ['Shield', 'shield', 2]] as const) {
        for (let i = 0; i < n; i++) {
          if (!(await page.getByRole('button', { name: 'More blocks, ' + id }).isVisible())) await page.getByRole('button', { name: new RegExp('^' + label + ', [0-9]+ blocks?$') }).click()
          await page.getByRole('button', { name: 'More blocks, ' + id }).click()
        }
      }
      if ((await page.getByRole('group', { name: 'ORBI asks' }).isVisible()) && !seen.has('guess')) {
        seen.add('guess')
        await scan(page, 'play-guess')
      }
      if ((await page.locator('.optbtn').count()) > 0 && !seen.has('card')) {
        seen.add('card')
        await scan(page, 'play-card')
      }
      await page.getByRole('button', { name: 'Next day' }).click()
    } else {
      await page.waitForTimeout(150)
    }
  }
  await scan(page, 'end')
  await page.getByRole('button', { name: 'Play again' }).click()
  await page.getByRole('button', { name: 'More' }).click()
  await scan(page, 'start-gear-open')
  await page.getByRole('button', { name: 'My storm cards' }).click()
  await scan(page, 'storm-cards')
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('button', { name: 'More' }).click()
  await page.getByRole('button', { name: /Today.s Sun/ }).click()
  await scan(page, 'todays-sun')
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('button', { name: 'Flare Journal' }).click()
  await scan(page, 'journal')
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('button', { name: 'More' }).click()
  await page.getByRole('button', { name: 'Settings' }).click()
  await scan(page, 'settings')
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('button', { name: 'More' }).click()
  await page.getByRole('button', { name: 'For teachers' }).click()
  await scan(page, 'teachers')
})

test.afterAll(() => {
  // Minor and moderate findings are listed for the status report, not failed.
  if (found.length) console.log('axe findings (all impacts):', JSON.stringify(found))
})
