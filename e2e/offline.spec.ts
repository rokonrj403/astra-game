import { expect, test } from '@playwright/test'

test('after one visit the game loads and plays with no network at all', async ({ page, context }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.5
  })
  await page.goto('/')
  // Wait until the service worker has cached the whole game (30 files: pages, art, fonts, data).
  await page.waitForFunction(async () => {
    await navigator.serviceWorker.ready
    const names = await caches.keys()
    for (const n of names) if (n.includes('precache') && (await (await caches.open(n)).keys()).length >= 25) return true
    return false
  })
  await page.reload() // now controlled by the service worker

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'ASTRA' })).toBeVisible()

  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: /Malapert Massif/ }).click()
  await page.getByRole('button', { name: 'Go' }).click()
  await page.getByRole('button', { name: /Cadet/ }).click()
  await expect(page.getByLabel('Day 1 of 10')).toBeVisible()

  // The art loaded from the cache, and Today's Sun is honest about having no network.
  const broken = await page.evaluate(() => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.alt))
  expect(broken, 'pictures that did not load offline').toEqual([])
  await expect(page.getByRole('button', { name: /Today's Sun, SAVED/ })).toBeVisible()

  await page.getByRole('button', { name: /^Air, [0-9]+ blocks?$/ }).click()
  await page.getByRole('button', { name: 'More blocks, air' }).click()
  await page.getByRole('button', { name: 'Next day' }).click()
  await expect(page.getByRole('heading', { name: 'Day 1' })).toBeVisible()

  await context.setOffline(false)
})
