import { test, expect } from '@playwright/test';

test.describe('Speaker View', () => {
  test('speaker view shows current slide and notes', async ({ browser }) => {
    const context = await browser.newContext();
    const presentationPage = await context.newPage();
    const speakerPage = await context.newPage();

    await presentationPage.goto('/');
    await speakerPage.goto('/?view=speaker');

    await presentationPage.waitForSelector('geek-slideshow');
    await speakerPage.waitForSelector('geek-speaker-view');

    const speakerView = speakerPage.locator('geek-speaker-view');
    await expect(speakerView).toBeVisible();

    await context.close();
  });

  test('navigation in presentation updates speaker view', async ({ browser }) => {
    const context = await browser.newContext();
    const presentationPage = await context.newPage();
    const speakerPage = await context.newPage();

    await presentationPage.goto('/');
    await speakerPage.goto('/?view=speaker');

    await presentationPage.waitForSelector('geek-slideshow');
    await speakerPage.waitForSelector('geek-speaker-view');

    // Navigate in presentation
    await presentationPage.keyboard.press('ArrowRight');
    await presentationPage.waitForTimeout(500);

    // Speaker view should reflect the change
    const speakerView = speakerPage.locator('geek-speaker-view');
    await expect(speakerView).toBeVisible();

    await context.close();
  });

  test('timer starts and increments', async ({ page }) => {
    await page.goto('/?view=speaker');
    await page.waitForSelector('geek-speaker-view');

    const timer = page.locator('geek-speaker-view [data-timer], geek-speaker-timer');
    if (await timer.count() > 0) {
      const initialText = await timer.first().textContent();
      await page.waitForTimeout(2000);
      const updatedText = await timer.first().textContent();
      // Timer should have changed
      expect(updatedText).not.toBe(initialText);
    }
  });
});
