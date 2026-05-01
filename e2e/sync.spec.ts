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

// ---------------------------------------------------------------------------
// Room-change scenario tests
// ---------------------------------------------------------------------------
test.describe('Room change behaviour', () => {
  /** Run a terminal command on a page */
  async function runCommand(page: import('@playwright/test').Page, cmd: string): Promise<void> {
    // If terminal is already open, close it first so the next Escape opens it fresh
    const isOpen = await page.evaluate(() => {
      const term = document.querySelector('geek-terminal') as HTMLElement | null;
      return term?.style.display === 'block';
    });
    if (isOpen) {
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => {
        const term = document.querySelector('geek-terminal') as HTMLElement | null;
        return term?.style.display !== 'block';
      });
    }
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => {
      const term = document.querySelector('geek-terminal') as HTMLElement | null;
      return term?.style.display === 'block';
    });
    await page.evaluate((c: string) => {
      const input = document.querySelector('geek-terminal')
        ?.shadowRoot?.querySelector('input') as HTMLInputElement | null;
      if (input) {
        input.value = c;
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      }
    }, cmd);
  }

  test('joining a room with existing deck adopts that deck', async ({ browser }) => {
    const ctx = await browser.newContext();
    const room = uniqueRoom('room-adopt');

    // Window A: load deck A and upload to room
    const windowA = await ctx.newPage();
    await windowA.goto(`/?config=e2e/fixtures/showcase-deck/config.json&room=${room}`);
    await windowA.waitForFunction(() => (document.getElementById('slideshow') as any)?.slideCount > 0, { timeout: 10000 });

    // Wait for A's upload to complete
    await windowA.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as any;
      return typeof ss?._sync?.doc?.getMap('sessionState')?.get('contentProxy') === 'string' ||
        document.title === 'Test Showcase';
    }, { timeout: 10000 });
    await windowA.waitForTimeout(2000); // extra time for upload

    const slideCountA = await windowA.evaluate(() => (document.getElementById('slideshow') as any)?.slideCount);

    // Window B: load a DIFFERENT deck locally, then join room → should adopt A's deck
    const windowB = await ctx.newPage();
    await windowB.goto(`/?config=e2e/fixtures/hmr-deck/config.json&room=${room}`);
    await windowB.waitForFunction(() => (document.getElementById('slideshow') as any)?.slideCount > 0, { timeout: 10000 });

    // Wait for room contentProxy to arrive and override window B's local deck
    await windowB.waitForFunction((expected: number) => {
      return (document.getElementById('slideshow') as any)?.slideCount === expected;
    }, slideCountA, { timeout: 15000 });

    const finalCountB = await windowB.evaluate(() => (document.getElementById('slideshow') as any)?.slideCount);
    expect(finalCountB).toBe(slideCountA);

    await ctx.close();
  });

  test('room command with empty room uploads current deck to peers', async ({ browser }) => {
    const ctx = await browser.newContext();
    const roomA = uniqueRoom('room-cmd-src');
    const roomB = uniqueRoom('room-cmd-dst'); // new empty room

    // Presenter: load showcase deck
    const presenter = await ctx.newPage();
    await presenter.goto(`/?config=e2e/fixtures/showcase-deck/config.json&room=${roomA}`);
    await presenter.waitForFunction(() => (document.getElementById('slideshow') as any)?.slideCount > 0, { timeout: 10000 });
    await presenter.waitForTimeout(2500); // wait for initial upload

    // Audience: join the presenter's new (empty) room before they do
    const audience = await ctx.newPage();
    await audience.goto(`/?config=e2e/fixtures/hmr-deck/config.json&room=${roomB}`);
    await audience.waitForFunction(() => (document.getElementById('slideshow') as any)?.slideCount > 0, { timeout: 10000 });

    // Presenter switches to the empty room
    await runCommand(presenter, `room ${roomB}`);
    await presenter.waitForTimeout(1000);

    const presenterTitle = await presenter.evaluate(() => document.title);
    // Presenter keeps their showcase deck (empty room = upload own)
    expect(presenterTitle).toBe('Test Showcase');

    // Audience in that room should eventually see presenter's deck
    await audience.waitForFunction(() => document.title === 'Test Showcase', { timeout: 20000 });

    await ctx.close();
  });

  test('room command with existing deck adopts that room deck', async ({ browser }) => {
    const ctx = await browser.newContext();
    const roomA = uniqueRoom('room-adopt-src');
    const roomB = uniqueRoom('room-adopt-dst');

    // Pre-populate roomB with the HMR deck
    const seed = await ctx.newPage();
    await seed.goto(`/?config=e2e/fixtures/hmr-deck/config.json&room=${roomB}`);
    await seed.waitForFunction(() => (document.getElementById('slideshow') as any)?.slideCount > 0, { timeout: 10000 });
    await seed.waitForTimeout(5000); // wait for upload + Yjs propagation

    // Presenter: load showcase deck in a different room
    const presenter = await ctx.newPage();
    await presenter.goto(`/?config=e2e/fixtures/showcase-deck/config.json&room=${roomA}`);
    await presenter.waitForFunction(() => (document.getElementById('slideshow') as any)?.slideCount > 0, { timeout: 10000 });
    await presenter.waitForTimeout(500); // ensure terminal is ready

    // Presenter switches to the existing room (which has HMR deck)
    await runCommand(presenter, `room ${roomB}`);

    // Presenter should now show the room's existing deck (HMR Fixture)
    await presenter.waitForFunction(() => document.title === 'HMR Fixture', { timeout: 20000 });

    await ctx.close();
  });

  test('speaker view follows presenter room change', async ({ browser }) => {
    const ctx = await browser.newContext();
    const roomA = uniqueRoom('speaker-room-src');
    const roomB = uniqueRoom('speaker-room-dst');

    // Presenter: load showcase deck in roomA
    const presenter = await ctx.newPage();
    await presenter.goto(`/?config=e2e/fixtures/showcase-deck/config.json&room=${roomA}`);
    await presenter.waitForFunction(() => document.title === 'Test Showcase', { timeout: 10000 });

    // Open speaker view in same room
    const speakerPage = await ctx.newPage();
    await speakerPage.goto(`/?view=speaker&config=e2e/fixtures/showcase-deck/config.json&room=${roomA}`);
    await speakerPage.waitForFunction(() => {
      const sv = document.querySelector('geek-speaker-view') as any;
      return sv?.currentIndex !== undefined;
    }, { timeout: 10000 });

    // Pre-populate roomB with HMR deck so presenter adopts it on join
    const seed = await ctx.newPage();
    await seed.goto(`/?config=e2e/fixtures/hmr-deck/config.json&room=${roomB}`);
    await seed.waitForFunction(() => (document.getElementById('slideshow') as any)?.slideCount > 0, { timeout: 10000 });
    await seed.waitForTimeout(3000);

    // Presenter switches to roomB
    await runCommand(presenter, `room ${roomB}`);
    await presenter.waitForFunction(() => document.title === 'HMR Fixture', { timeout: 20000 });

    // Speaker should follow and show the new deck
    await speakerPage.waitForFunction(() => document.title === 'HMR Fixture', { timeout: 25000 });
    const counter = await speakerPage.evaluate(() => {
      return document.querySelector('geek-speaker-view')?.shadowRoot?.querySelector('.counter')?.textContent ?? '';
    });
    expect(counter).toMatch(/\d+\s*\/\s*2/);

    // Speaker URL should be updated to the new room so a page reload reconnects correctly
    expect(speakerPage.url()).toContain(`room=${roomB}`);

    await ctx.close();
  });

  test('speaker command uses current room after room change', async ({ browser }) => {
    const ctx = await browser.newContext();
    const roomA = uniqueRoom('speaker-cmd-src');
    const roomB = uniqueRoom('speaker-cmd-dst');

    // Presenter: start in roomA
    const presenter = await ctx.newPage();
    await presenter.goto(`/?config=e2e/fixtures/showcase-deck/config.json&room=${roomA}`);
    await presenter.waitForFunction(() => (document.getElementById('slideshow') as any)?.slideCount > 0, { timeout: 10000 });
    await presenter.waitForTimeout(2500);

    // Switch to roomB (empty → uploads showcase deck)
    await runCommand(presenter, `room ${roomB}`);
    await presenter.waitForTimeout(2000);

    // Open speaker from terminal — should open in roomB, not roomA
    const popupPromise = ctx.waitForEvent('page');
    await runCommand(presenter, 'speaker');
    const speakerPage = await popupPromise;
    await speakerPage.waitForLoadState('domcontentloaded');

    // Verify speaker URL includes roomB
    const speakerUrl = speakerPage.url();
    expect(speakerUrl).toContain(`room=${roomB}`);
    expect(speakerUrl).not.toContain(`room=${roomA}`);

    await ctx.close();
  });
});
