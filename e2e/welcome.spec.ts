import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * The welcome tour (crew intro and base tour), played by touch in the phone-size browser, with motion ON.
 * It is reached through the ?welcome preview of the app. Saves frames to e2e-shots/welcome/.
 */
const SHOTS = 'e2e-shots/welcome'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.5
  })
  await page.route('**/DONKI-API/**', (r) => r.abort())
})

const STEPS = ['lander', 'crew-safia', 'crew-kofi', 'crew-leo', 'crew-mei', 'orbi', 'b-air', 'b-radio', 'b-shield', 'power', 'rays', 'goal']

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('plays every step in order, each with at most 3 words, fits the phone, and ends on the Start screen', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('./?welcome')
    const main = page.locator('main.welcome')
    await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible() // from the first second
    const skip = await page.getByRole('button', { name: 'Skip' }).boundingBox()
    expect(skip && Math.min(skip.width, skip.height), 'Skip tap target').toBeGreaterThanOrEqual(44)
    for (const id of STEPS) {
      await expect(main).toHaveAttribute('data-step', id, { timeout: 7000 })
      const height = await page.evaluate(() => document.documentElement.scrollHeight)
      expect(height, `${id}: page is ${height}px tall`).toBeLessThanOrEqual(740)
      const words = await page.evaluate(() => (document.querySelector('main')!.innerText ?? '').trim().split(/\s+/).filter(Boolean).length)
      expect(words, `${id}: visible words`).toBeLessThanOrEqual(3)
      const wide = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(wide, `${id}: page scrolls sideways`).toBeLessThanOrEqual(360)
      if (id === 'crew-mei') {
        await page.waitForTimeout(1300) // all four are out
        await page.screenshot({ path: `${SHOTS}/01-crew-lineup.png` })
      }
      if (id === 'b-shield') {
        await page.waitForTimeout(900)
        await page.screenshot({ path: `${SHOTS}/02-orbi-at-dome.png` })
      }
      if (id === 'power') {
        await page.waitForTimeout(1800)
        await page.screenshot({ path: `${SHOTS}/03-sun-power.png` })
      }
      if (id === 'b-air') {
        // the Air building lights up and its picture flies to the Air bar, which is outlined
        await expect(page.locator('.wl-strip')).toHaveAttribute('data-pulse', 'Air', { timeout: 3000 })
        const bad = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
        expect(bad.map((v) => v.id), 'axe on the base tour').toEqual([])
      }
    }
    // The tour ends by itself and hands over (here: the Start screen).
    await expect(page.getByRole('button', { name: /Play/ })).toBeVisible({ timeout: 8000 })
  })

  test('Skip works at any time and goes straight on', async ({ page }) => {
    await page.goto('./?welcome')
    await page.waitForTimeout(1500)
    await page.getByRole('button', { name: 'Skip' }).tap()
    await expect(page.getByRole('button', { name: /Play/ })).toBeVisible({ timeout: 2000 })
    await expect(page.locator('main.welcome')).toHaveCount(0)
  })

  test('Commander gets the food beat', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto('./?welcome=commander')
    await expect(page.getByRole('meter', { name: 'Food' })).toBeVisible()
    await expect(page.locator('main.welcome')).toHaveAttribute('data-step', 'b-plants', { timeout: 30_000 })
  })
})

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('the same steps play as still pictures: no flying icons, no motion class', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto('./?welcome')
    const main = page.locator('main.welcome')
    await expect(main).toHaveClass(/still/)
    await expect(main).toHaveAttribute('data-step', 'crew-kofi', { timeout: 7000 })
    await expect(main).toHaveAttribute('data-step', 'b-air', { timeout: 20_000 })
    await expect(page.locator('.wl-fly')).toHaveCount(0)
    await expect(page.locator('.wl-strip')).toHaveAttribute('data-pulse', 'Air') // the bar is outlined at once
  })
})
