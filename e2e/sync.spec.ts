import { test, expect } from '@playwright/test';

test.describe('Synchronization', () => {
  test('two contexts stay synced via yjs', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await page1.goto('/');
    await page2.goto('/');

    await page1.waitForSelector('geek-slideshow');
    await page2.waitForSelector('geek-slideshow');

    // Navigate in page1
    await page1.keyboard.press('ArrowRight');
    await page1.waitForTimeout(500);

    // page2 should sync
    const slideshow2 = page2.locator('geek-slideshow');
    await expect(slideshow2).toHaveAttribute('current-slide', '1', { timeout: 3000 });

    await context1.close();
    await context2.close();
  });

  test('follow/unfollow toggle breaks sync', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await page1.goto('/');
    await page2.goto('/');

    await page1.waitForSelector('geek-slideshow');
    await page2.waitForSelector('geek-slideshow');

    // Unfollow in page2 (Ctrl+B, u)
    await page2.keyboard.press('Control+b');
    await page2.keyboard.press('u');
    await page2.waitForTimeout(200);

    // Navigate in page1
    await page1.keyboard.press('ArrowRight');
    await page1.waitForTimeout(500);

    // page2 should NOT have moved (unfollowed)
    const slideshow2 = page2.locator('geek-slideshow');
    await expect(slideshow2).toHaveAttribute('current-slide', '0');

    await context1.close();
    await context2.close();
  });
});
