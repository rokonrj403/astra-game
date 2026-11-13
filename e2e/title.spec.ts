import { expect, test } from '@playwright/test'

/**
 * The Start screen's attract loop, with motion ON (the other specs run with reduced motion).
 * Checks the loop really runs (flare, rays, wave), the Play zoom leads to the map, and the screen fits 360x740 with no scroll.
 * Saves the frames to e2e-shots/title/.
 */
const SHOTS = 'e2e-shots/title'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.5
  })
  await page.route('**/DONKI-API/**', (r) => r.abort())
})

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('the loop runs: flare, rays on the shield, a crew face waves; Play zooms into the map', async ({ page }) => {
    await page.goto('./')
    const scene = page.locator('.attract-scene')
    await expect(scene).toHaveAttribute('data-still', 'no')
    await page.screenshot({ path: `${SHOTS}/01-start-frame.png` })

    await expect(scene).toHaveAttribute('data-phase', 'flare', { timeout: 6000 })
    await expect(page.locator('.sc-burst')).toBeVisible()
    await expect(scene).toHaveAttribute('data-phase', 'rays', { timeout: 6000 })
    await expect(page.locator('.sc-rays')).toHaveAttribute('data-rays', '14')
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${SHOTS}/02-mid-flare.png` })
    await expect(scene).toHaveAttribute('data-phase', 'wave', { timeout: 6000 })
    await expect(page.locator('.peek')).toBeVisible()
    await expect(scene).toHaveAttribute('data-phase', 'idle', { timeout: 6000 })
    await expect(scene).toHaveAttribute('data-phase', 'flare', { timeout: 6000 }) // and it loops

    // It all fits the phone with no scrolling, and every tap target is big enough.
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    expect(height, `start screen is ${height}px tall`).toBeLessThanOrEqual(740)
    for (const name of ['Sound', 'More', 'Flare Journal']) {
      const box = await page.getByRole('button', { name }).boundingBox()
      expect(box && Math.min(box.width, box.height), `${name} tap target`).toBeGreaterThanOrEqual(44)
    }
    const play = await page.getByRole('button', { name: /Play/ }).boundingBox()
    expect(play && play.height, 'Play is big').toBeGreaterThanOrEqual(64)

    await page.getByRole('button', { name: /Play/ }).click()
    await expect(page.locator('main.attract')).toHaveClass(/leaving/)
    await expect(page.locator('.polemap').first()).toBeVisible({ timeout: 3000 })
  })

  test('the gear opens a sheet that reaches every adult page', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('button', { name: 'More' }).click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${SHOTS}/03-gear-sheet.png` })
    await page.getByRole('button', { name: 'Where the data comes from' }).click()
    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible()
  })

  test('the first tap on the screen wakes the audio without breaking anything, and mute is remembered', async ({ page }) => {
    await page.goto('./')
    await page.locator('.starthead h1').click()
    const sound = page.getByRole('button', { name: 'Sound' })
    await expect(sound).toHaveAttribute('aria-pressed', 'true')
    await sound.click()
    await expect(sound).toHaveAttribute('aria-pressed', 'false')
    await page.reload()
    await expect(page.getByRole('button', { name: 'Sound' })).toHaveAttribute('aria-pressed', 'false')
  })
})

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('the scene is one still picture: no rays, no peeking face, no paw', async ({ page }) => {
    await page.goto('./')
    const scene = page.locator('.attract-scene')
    await expect(scene).toHaveAttribute('data-still', 'yes')
    await page.waitForTimeout(3500)
    await expect(scene).toHaveAttribute('data-phase', 'idle')
    await expect(page.locator('.sc-rays')).toHaveCount(0)
    await expect(page.locator('.peek')).toHaveCount(0)
    await expect(page.locator('[data-paw]')).toHaveCount(0)
    await page.getByRole('button', { name: /Play/ }).click()
    await expect(page.locator('.polemap').first()).toBeVisible({ timeout: 1500 }) // no zoom wait
  })
})
