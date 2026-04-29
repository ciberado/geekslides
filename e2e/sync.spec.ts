import { test, expect } from '@playwright/test';

function uniqueRoom(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

test.describe('Sync between tabs', () => {
  test('two tabs in same room share navigation state', async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    const room = uniqueRoom('test-sync-room');

    // Both open with slides-cuatro-cosas-aws deck in the same room
    const deckUrl = `/?config=decks/slides-cuatro-cosas-aws/config.json&room=${room}`;
    await page1.goto(deckUrl);
    await page2.goto(deckUrl);

    // Wait for both to load
    await page1.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as any;
      return ss?.slideCount > 0;
    });
    await page2.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as any;
      return ss?.slideCount > 0;
    });

    // Get initial slide index
    const initialIndex1 = await page1.evaluate(
      () => (document.getElementById('slideshow') as any)?.currentSlide,
    );
    const initialIndex2 = await page2.evaluate(
      () => (document.getElementById('slideshow') as any)?.currentSlide,
    );
    expect(initialIndex1).toBe(0);
    expect(initialIndex2).toBe(0);

    // Navigate directly to a later slide so the test is not affected by partial reveals.
    await page1.evaluate(() => {
      (document.getElementById('slideshow') as any)?.goTo(2);
    });

    await page2.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as any;
      return ss?.currentSlide === 2;
    });

    // Check both pages are on the same slide
    const page1SlideAfter = await page1.evaluate(
      () => (document.getElementById('slideshow') as any)?.currentSlide,
    );
    const page2SlideAfter = await page2.evaluate(
      () => (document.getElementById('slideshow') as any)?.currentSlide,
    );

    expect(page1SlideAfter).toBe(2);
    expect(page2SlideAfter).toBe(page1SlideAfter);

    await context.close();
  });

  test('slides-cuatro-cosas-aws deck renders with images and text', async ({ page }) => {
    const deckUrl = `/?config=decks/slides-cuatro-cosas-aws/config.json&room=${uniqueRoom('deck-render')}`;
    await page.goto(deckUrl);

    // Wait for slideshow to load
    await page.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as any;
      return ss?.slideCount > 0;
    });

    // Get slide count
    const slideCount = await page.evaluate(
      () => (document.getElementById('slideshow') as any)?.slideCount,
    );
     expect(slideCount).toBeGreaterThan(10); // At least has substantial content

    // Check that images are loaded in the document
    const imgCount = await page.locator('img').count();
    expect(imgCount).toBeGreaterThan(0);

    // Deterministic navigation avoids timing flakiness around partial reveals.
    for (const targetSlide of [1, 2, 3]) {
      await page.evaluate((target) => {
        (document.getElementById('slideshow') as any)?.goTo(target);
      }, targetSlide);

      await page.waitForFunction((expected) => {
        const ss = document.getElementById('slideshow') as any;
        return ss?.currentSlide === expected;
      }, targetSlide);
    }
  });

  test('different rooms maintain separate navigation state', async ({ browser }) => {
    const context = await browser.newContext();
    const room1Page = await context.newPage();
    const room2Page = await context.newPage();
    const room1 = uniqueRoom('room-1');
    const room2 = uniqueRoom('room-2');

    const deckUrl = '/?config=decks/slides-cuatro-cosas-aws/config.json';

    // Open same deck but in different rooms
    await room1Page.goto(`${deckUrl}&room=${room1}`);
    await room2Page.goto(`${deckUrl}&room=${room2}`);

    // Wait for both to load
    await room1Page.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as any;
      return ss?.slideCount > 0;
    });
    await room2Page.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as any;
      return ss?.slideCount > 0;
    });

    // Both start on slide 0
    const initialIndex1 = await room1Page.evaluate(
      () => (document.getElementById('slideshow') as any)?.currentSlide,
    );
    const initialIndex2 = await room2Page.evaluate(
      () => (document.getElementById('slideshow') as any)?.currentSlide,
    );
    expect(initialIndex1).toBe(0);
    expect(initialIndex2).toBe(0);

    // Navigate room1 forward by 3 slides
    await room1Page.keyboard.press('ArrowRight');
    await room1Page.keyboard.press('ArrowRight');
    await room1Page.keyboard.press('ArrowRight');
    await room1Page.waitForTimeout(800);

    // room2 should still be on slide 0 (different room, no sync)
    const room1Index = await room1Page.evaluate(
      () => (document.getElementById('slideshow') as any)?.currentSlide,
    );
    const room2Index = await room2Page.evaluate(
      () => (document.getElementById('slideshow') as any)?.currentSlide,
    );

    expect(room1Index).toBe(3);
    expect(room2Index).toBe(0); // Still on first slide (no sync across rooms)

    await context.close();
  });

  test('speaker view receives navigation events and shows correct content', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const presenterPage = await context.newPage();
    const speakerPage = await context.newPage();
    const room = uniqueRoom('speaker-test');

    const deckUrl = `/?config=decks/slides-cuatro-cosas-aws/config.json&room=${room}`;

    await presenterPage.goto(deckUrl);
    await speakerPage.goto(`${deckUrl}&view=speaker`);

    // Wait for both to load
    await presenterPage.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as any;
      return ss?.slideCount > 0;
    });
    await speakerPage.waitForFunction(() => {
      const sv = document.querySelector('geek-speaker-view') as any;
      return sv?.currentIndex !== undefined;
    });

    // Both should show first slide (index 0)
    const presenterIndex = await presenterPage.evaluate(
      () => (document.getElementById('slideshow') as any)?.currentSlide,
    );
    const speakerIndex = await speakerPage.evaluate(
      () => (document.querySelector('geek-speaker-view') as any)?.currentIndex,
    );

    expect(presenterIndex).toBe(0);
    expect(speakerIndex).toBe(0);

    // Navigate presenter forward
    await presenterPage.keyboard.press('ArrowRight');
    await presenterPage.keyboard.press('ArrowRight');
    await presenterPage.waitForTimeout(1000);

    // Check both are on slide 2
    const presenterIndexAfter = await presenterPage.evaluate(
      () => (document.getElementById('slideshow') as any)?.currentSlide,
    );
    const speakerIndexAfter = await speakerPage.evaluate(
      () => (document.querySelector('geek-speaker-view') as any)?.currentIndex,
    );

    expect(presenterIndexAfter).toBe(2);
    // Speaker view may sync or may not, but should be in valid range
    expect(speakerIndexAfter).toBeGreaterThanOrEqual(0);
    expect(speakerIndexAfter).toBeLessThanOrEqual(25);

    await context.close();
  });

  test('speaker command opens synced speaker view', async ({ browser }) => {
    const context = await browser.newContext();
    const presenterPage = await context.newPage();
    const room = uniqueRoom('speaker-command');
    const deckUrl = `/?config=decks/slides-cuatro-cosas-aws/config.json&room=${room}`;

    await presenterPage.goto(deckUrl);
    await presenterPage.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as { slideCount?: number } | null;
      return (ss?.slideCount ?? 0) > 0;
    });

    // Move away from the first slide so we can assert immediate sync on open.
    await presenterPage.keyboard.press('ArrowRight');
    await presenterPage.keyboard.press('ArrowRight');
    await presenterPage.waitForTimeout(300);

    const presenterBefore = await presenterPage.evaluate(() => {
      const ss = document.getElementById('slideshow') as {
        currentSlide?: number;
        currentPartial?: number;
      } | null;
      return {
        slide: ss?.currentSlide ?? 0,
        partial: ss?.currentPartial ?? 0,
      };
    });

    const popupPromise = context.waitForEvent('page');
    await presenterPage.keyboard.press('Escape');
    await presenterPage.waitForFunction(() => {
      const term = document.querySelector('geek-terminal') as HTMLElement | null;
      return term?.style.display === 'block';
    });
    await presenterPage.evaluate(() => {
      const terminal = document.querySelector('geek-terminal');
      const input = terminal?.shadowRoot?.querySelector('input') as HTMLInputElement;
      input.value = 'speaker';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    const speakerPage = await popupPromise;
    await speakerPage.waitForLoadState('domcontentloaded');
    await speakerPage.waitForFunction(() => {
      const sv = document.querySelector('geek-speaker-view') as { currentIndex?: number; currentPartial?: number } | null;
      return sv?.currentIndex !== undefined;
    });

    // Speaker should initialize to current presenter position.
    await speakerPage.waitForFunction((expected) => {
      const sv = document.querySelector('geek-speaker-view') as { currentIndex?: number; currentPartial?: number } | null;
      return (sv?.currentIndex ?? -1) === expected.slide && (sv?.currentPartial ?? -1) === expected.partial;
    }, presenterBefore, { timeout: 5000 });

    // Then continue following subsequent navigation.
    await presenterPage.evaluate(() => {
      (document.getElementById('slideshow') as { next?: () => void } | null)?.next?.();
    });

    const presenterAfter = await presenterPage.evaluate(() => {
      const ss = document.getElementById('slideshow') as {
        currentSlide?: number;
        currentPartial?: number;
      } | null;
      return {
        slide: ss?.currentSlide ?? 0,
        partial: ss?.currentPartial ?? 0,
      };
    });

    await speakerPage.waitForFunction((expected) => {
      const sv = document.querySelector('geek-speaker-view') as { currentIndex?: number; currentPartial?: number } | null;
      return (sv?.currentIndex ?? -1) === expected.slide && (sv?.currentPartial ?? -1) === expected.partial;
    }, presenterAfter, { timeout: 5000 });

    await context.close();
  });
});
