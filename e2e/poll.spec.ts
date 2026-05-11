/**
 * E2E tests for the live poll feature.
 *
 * Fixture deck: e2e/fixtures/poll-deck/
 *   Slide 0: intro (no poll)
 *   Slide 1: .poll — "Favourite language?" with 4 options
 *   Slide 2: outro (no poll)
 */

import { test, expect, type Page } from '@playwright/test';

const DECK = 'e2e/fixtures/poll-deck/config.json';
const POLL_SLIDE = 1;

function uniqueRoom(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Wait for the slideshow to finish loading. */
async function waitForSlideshow(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const ss = document.getElementById('slideshow') as { slideCount?: number } | null;
    return (ss?.slideCount ?? 0) > 0;
  });
}

/** Navigate the presenter to a specific slide index via the JS API. */
async function goToSlide(page: Page, index: number): Promise<void> {
  await page.evaluate((idx) => {
    (document.getElementById('slideshow') as { goTo?: (n: number) => void })?.goTo?.(idx);
  }, index);
}

/** Wait until the slideshow reports the given current slide index. */
async function waitForSlide(page: Page, index: number): Promise<void> {
  await page.waitForFunction((idx) => {
    const ss = document.getElementById('slideshow') as { currentSlide?: number } | null;
    return ss?.currentSlide === idx;
  }, index, { timeout: 8000 });
}

/** Find the poll panel element (Playwright auto-pierces shadow DOM). */
function pollPanel(page: Page) {
  return page.locator('.gs-poll-panel');
}

/** Open the presenter on the poll deck and navigate to the poll slide. */
async function openPresenter(context: Awaited<ReturnType<typeof import('@playwright/test').Browser.prototype.newContext>>, room: string): Promise<Page> {
  const presenter = await context.newPage();
  await presenter.goto(`/?config=${DECK}&room=${room}`);
  await waitForSlideshow(presenter);
  await goToSlide(presenter, POLL_SLIDE);
  // Wait for Yjs to publish poll options before viewers connect
  await presenter.waitForTimeout(1200);
  return presenter;
}

/** Open a readonly viewer on the poll deck and wait for it to reach the poll slide. */
async function openViewer(context: Awaited<ReturnType<typeof import('@playwright/test').Browser.prototype.newContext>>, room: string): Promise<Page> {
  const viewer = await context.newPage();
  await viewer.goto(`/?config=${DECK}&room=${room}&readonly`);
  await waitForSlideshow(viewer);
  // Viewer follows presenter to the poll slide via Yjs sync
  await waitForSlide(viewer, POLL_SLIDE);
  return viewer;
}

// ---------------------------------------------------------------------------
// Presenter mode
// ---------------------------------------------------------------------------

test.describe('Poll — presenter mode', () => {
  test('no poll panel on a non-poll slide', async ({ page }) => {
    const room = uniqueRoom('poll-no-panel');
    await page.goto(`/?config=${DECK}&room=${room}`);
    await waitForSlideshow(page);
    // Slide 0 is the intro, no .poll class
    await expect(pollPanel(page)).toHaveCount(0);
  });

  test('poll panel appears when navigating to a poll slide', async ({ page }) => {
    const room = uniqueRoom('poll-appear');
    await page.goto(`/?config=${DECK}&room=${room}`);
    await waitForSlideshow(page);
    await goToSlide(page, POLL_SLIDE);
    await expect(pollPanel(page)).toBeVisible({ timeout: 5000 });
  });

  test('poll panel disappears when leaving a poll slide', async ({ page }) => {
    const room = uniqueRoom('poll-disappear');
    await page.goto(`/?config=${DECK}&room=${room}`);
    await waitForSlideshow(page);
    await goToSlide(page, POLL_SLIDE);
    await expect(pollPanel(page)).toBeVisible({ timeout: 5000 });
    await goToSlide(page, 2);
    await expect(pollPanel(page)).toHaveCount(0, { timeout: 3000 });
  });

  test('QR code image is rendered inside the panel', async ({ page }) => {
    const room = uniqueRoom('poll-qr');
    await page.goto(`/?config=${DECK}&room=${room}`);
    await waitForSlideshow(page);
    await goToSlide(page, POLL_SLIDE);
    await expect(pollPanel(page)).toBeVisible({ timeout: 5000 });
    const qrImg = page.locator('.gs-poll-qr-img');
    await expect(qrImg).toHaveAttribute('src', /^data:image\/png/, { timeout: 5000 });
  });

  test('freeze button is visible to presenter', async ({ page }) => {
    const room = uniqueRoom('poll-freeze-btn');
    await page.goto(`/?config=${DECK}&room=${room}`);
    await waitForSlideshow(page);
    await goToSlide(page, POLL_SLIDE);
    await expect(page.locator('.gs-poll-freeze-btn')).toBeVisible({ timeout: 5000 });
  });

  test('vote count starts at 0', async ({ page }) => {
    const room = uniqueRoom('poll-zero');
    await page.goto(`/?config=${DECK}&room=${room}`);
    await waitForSlideshow(page);
    await goToSlide(page, POLL_SLIDE);
    await expect(pollPanel(page)).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.gs-poll-count')).toContainText('0 votes');
  });

  test('clicking freeze hides QR and shows chart', async ({ page }) => {
    const room = uniqueRoom('poll-freeze');
    await page.goto(`/?config=${DECK}&room=${room}`);
    await waitForSlideshow(page);
    await goToSlide(page, POLL_SLIDE);
    await expect(pollPanel(page)).toBeVisible({ timeout: 5000 });

    const qrWrap = page.locator('.gs-poll-qr');
    await expect(qrWrap).toBeVisible();

    await page.locator('.gs-poll-freeze-btn').click();

    await expect(qrWrap).toBeHidden({ timeout: 3000 });
    await expect(page.locator('.gs-poll-chart-wrap')).toBeVisible({ timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// vote.html voter page
// ---------------------------------------------------------------------------

test.describe('Poll — vote.html voter page', () => {
  test('vote page loads and shows options', async ({ browser }) => {
    const context = await browser.newContext();
    const room = uniqueRoom('poll-vote-page');

    const presenter = await openPresenter(context, room);

    const voter = await context.newPage();
    await voter.goto(`/vote.html?room=${encodeURIComponent(room)}&slide=${POLL_SLIDE}`);
    await expect(voter.locator('.option-btn').first()).toBeVisible({ timeout: 10000 });
    await expect(voter.locator('.option-btn')).toHaveCount(4);

    await presenter.close();
    await context.close();
  });

  test('vote page clicking an option updates presenter vote count', async ({ browser }) => {
    const context = await browser.newContext();
    const room = uniqueRoom('poll-vote-count');

    const presenter = await openPresenter(context, room);

    const voter = await context.newPage();
    await voter.goto(`/vote.html?room=${encodeURIComponent(room)}&slide=${POLL_SLIDE}`);
    await expect(voter.locator('.option-btn').first()).toBeVisible({ timeout: 10000 });

    await voter.locator('.option-btn').first().click();

    await expect(presenter.locator('.gs-poll-count')).toContainText('1 vote', { timeout: 8000 });

    await context.close();
  });

  test('vote page disables all buttons after voting', async ({ browser }) => {
    const context = await browser.newContext();
    const room = uniqueRoom('poll-vote-disabled');

    await openPresenter(context, room);

    const voter = await context.newPage();
    await voter.goto(`/vote.html?room=${encodeURIComponent(room)}&slide=${POLL_SLIDE}`);
    await expect(voter.locator('.option-btn').first()).toBeVisible({ timeout: 10000 });
    await voter.locator('.option-btn').first().click();
    await voter.waitForTimeout(300);

    const buttons = voter.locator('.option-btn');
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      await expect(buttons.nth(i)).toBeDisabled();
    }

    await context.close();
  });

  test('vote page shows frozen state when presenter freezes poll', async ({ browser }) => {
    const context = await browser.newContext();
    const room = uniqueRoom('poll-frozen-voter');

    const presenter = await openPresenter(context, room);

    const voter = await context.newPage();
    await voter.goto(`/vote.html?room=${encodeURIComponent(room)}&slide=${POLL_SLIDE}`);
    await expect(voter.locator('.option-btn').first()).toBeVisible({ timeout: 10000 });

    await presenter.locator('.gs-poll-freeze-btn').click();

    // After freeze the voter page shows results (frozen-banner visible)
    await expect(voter.locator('.frozen-banner')).toBeVisible({ timeout: 8000 });

    await context.close();
  });
});

// ---------------------------------------------------------------------------
// Viewer (readonly) mode
// ---------------------------------------------------------------------------

test.describe('Poll — viewer (readonly) mode', () => {
  test('viewer sees clickable option buttons instead of QR', async ({ browser }) => {
    const context = await browser.newContext();
    const room = uniqueRoom('poll-viewer-btns');

    await openPresenter(context, room);
    const viewer = await openViewer(context, room);

    await expect(viewer.locator('.gs-poll-voter-btn').first()).toBeVisible({ timeout: 8000 });
    await expect(viewer.locator('.gs-poll-qr')).toHaveCount(0);

    await context.close();
  });

  test('viewer does not see the freeze button', async ({ browser }) => {
    const context = await browser.newContext();
    const room = uniqueRoom('poll-viewer-no-freeze');

    await openPresenter(context, room);
    const viewer = await openViewer(context, room);

    await expect(pollPanel(viewer)).toBeVisible({ timeout: 8000 });
    await expect(viewer.locator('.gs-poll-freeze-btn')).toHaveCount(0);

    await context.close();
  });

  test('viewer clicking an option updates presenter vote count via HTTP API', async ({ browser }) => {
    const context = await browser.newContext();
    const room = uniqueRoom('poll-viewer-vote');

    const presenter = await openPresenter(context, room);
    const viewer = await openViewer(context, room);

    const viewerBtn = viewer.locator('.gs-poll-voter-btn').first();
    await expect(viewerBtn).toBeVisible({ timeout: 8000 });
    await viewerBtn.click();

    await expect(presenter.locator('.gs-poll-count')).toContainText('1 vote', { timeout: 8000 });

    await context.close();
  });

  test('viewer buttons disable after voting', async ({ browser }) => {
    const context = await browser.newContext();
    const room = uniqueRoom('poll-viewer-disabled');

    await openPresenter(context, room);
    const viewer = await openViewer(context, room);

    const btns = viewer.locator('.gs-poll-voter-btn');
    await expect(btns.first()).toBeVisible({ timeout: 8000 });
    await btns.first().click();
    await viewer.waitForTimeout(300);

    const count = await btns.count();
    for (let i = 0; i < count; i++) {
      await expect(btns.nth(i)).toBeDisabled();
    }

    await context.close();
  });

  test('viewer sees live vote count update when vote.html voter votes', async ({ browser }) => {
    const context = await browser.newContext();
    const room = uniqueRoom('poll-viewer-live');

    await openPresenter(context, room);
    const viewer = await openViewer(context, room);

    await expect(viewer.locator('.gs-poll-count')).toContainText('0 votes', { timeout: 5000 });

    // External voter via vote.html
    const voter = await context.newPage();
    await voter.goto(`/vote.html?room=${encodeURIComponent(room)}&slide=${POLL_SLIDE}`);
    await expect(voter.locator('.option-btn').first()).toBeVisible({ timeout: 10000 });
    await voter.locator('.option-btn').first().click();

    await expect(viewer.locator('.gs-poll-count')).toContainText('1 vote', { timeout: 8000 });

    await context.close();
  });

  test('viewer frozen indicator appears when presenter freezes', async ({ browser }) => {
    const context = await browser.newContext();
    const room = uniqueRoom('poll-viewer-frozen');

    const presenter = await openPresenter(context, room);
    const viewer = await openViewer(context, room);

    await expect(pollPanel(viewer)).toBeVisible({ timeout: 8000 });

    await presenter.locator('.gs-poll-freeze-btn').click();

    await expect(viewer.locator('.gs-poll-frozen-viewer')).toBeVisible({ timeout: 8000 });

    await context.close();
  });

  test('/api/feature-write returns 404 for unknown room', async ({ request }) => {
    const response = await request.post('/api/feature-write', {
      data: { room: 'no-such-room-xyz', featureId: 'poll', updates: { k: 1 } },
    });
    expect(response.status()).toBe(404);
  });

  test('/api/feature-write returns 400 for missing fields', async ({ request }) => {
    const response = await request.post('/api/feature-write', {
      data: { room: 'r' },
    });
    expect(response.status()).toBe(400);
  });
});

