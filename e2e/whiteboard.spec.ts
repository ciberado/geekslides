import { test, expect } from '@playwright/test';

function uniqueRoom(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

test.describe('Whiteboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/?config=e2e/fixtures/layouts-deck/config.json&room=${uniqueRoom('whiteboard')}`);
    await page.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as any;
      return ss?.slideCount > 0;
    });
    // Wait for the whiteboard feature to activate (it loads asynchronously after slides)
    await page.waitForFunction(() => {
      const ss = document.getElementById('slideshow');
      return !!ss?.shadowRoot?.querySelector('geek-whiteboard');
    });
  });

  test('whiteboard command toggles canvas overlay', async ({ page }) => {
    // Open terminal and run whiteboard command
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.keyboard.type('whiteboard');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    // Close terminal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Check that geek-whiteboard exists and is visible
    const visible = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard') as any;
      return wb?.isVisible === true;
    });
    expect(visible).toBe(true);

    // Toggle off via command
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.keyboard.type('whiteboard');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    const hiddenAfterToggle = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard') as any;
      return wb?.isVisible;
    });
    expect(hiddenAfterToggle).toBe(false);
  });

  test('auto-activates on mouse drag over slide', async ({ page }) => {
    // Confirm whiteboard starts hidden
    const initiallyHidden = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard') as any;
      return wb?.isVisible === false;
    });
    expect(initiallyHidden).toBe(true);

    // Get container bounds for mouse drag
    const box = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const container = ss?.shadowRoot?.querySelector('.gs-container');
      const rect = container?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
    });
    expect(box).toBeTruthy();

    const startX = box!.x + box!.width * 0.3;
    const startY = box!.y + box!.height * 0.3;
    const endX = box!.x + box!.width * 0.5;
    const endY = box!.y + box!.height * 0.5;

    // Perform a mouse drag (pointerdown + pointermove)
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 5 });
    await page.waitForTimeout(100);

    // Check whiteboard became visible after drag
    const visibleAfterDrag = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard') as any;
      return wb?.isVisible === true;
    });
    expect(visibleAfterDrag).toBe(true);

    await page.mouse.up();
  });

  test('draw strokes on canvas', async ({ page }) => {
    // Activate whiteboard
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('whiteboard');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Get canvas bounds through the shadow DOM
    const canvasBounds = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const canvas = wb?.shadowRoot?.querySelector('canvas');
      const rect = canvas?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
    });
    expect(canvasBounds).toBeTruthy();

    // Listen for stroke event
    const strokePromise = page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const ss = document.getElementById('slideshow');
        const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
        wb?.addEventListener('geek:whiteboard:stroke', () => resolve(true), { once: true });
        setTimeout(() => resolve(false), 3000);
      });
    });

    // Drag across the canvas
    const cx = canvasBounds!.x + canvasBounds!.width * 0.3;
    const cy = canvasBounds!.y + canvasBounds!.height * 0.3;
    const ex = canvasBounds!.x + canvasBounds!.width * 0.7;
    const ey = canvasBounds!.y + canvasBounds!.height * 0.7;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(ex, ey, { steps: 10 });
    await page.mouse.up();

    const strokeDispatched = await strokePromise;
    expect(strokeDispatched).toBe(true);
  });

  test('per-slide persistence across navigation', async ({ page }) => {
    // Activate whiteboard via command
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('whiteboard');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Draw a stroke on slide 0
    const canvasBounds = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const canvas = wb?.shadowRoot?.querySelector('canvas');
      const rect = canvas?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
    });
    expect(canvasBounds).toBeTruthy();

    const cx = canvasBounds!.x + canvasBounds!.width * 0.4;
    const cy = canvasBounds!.y + canvasBounds!.height * 0.4;
    const ex = canvasBounds!.x + canvasBounds!.width * 0.6;
    const ey = canvasBounds!.y + canvasBounds!.height * 0.6;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(ex, ey, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(100);

    // Read a pixel from the drawn area on slide 0 canvas
    const slide0HasContent = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const canvas = wb?.shadowRoot?.querySelector('canvas');
      if (!canvas) return false;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      // Check center area for non-transparent pixels
      const data = ctx.getImageData(canvas.width * 0.4, canvas.height * 0.4, canvas.width * 0.2, canvas.height * 0.2).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i]! > 0) return true; // Found a non-transparent pixel
      }
      return false;
    });
    expect(slide0HasContent).toBe(true);

    // Navigate to slide 1
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);

    // Canvas should be clear on slide 1
    const slide1IsEmpty = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const canvas = wb?.shadowRoot?.querySelector('canvas');
      if (!canvas) return true;
      const ctx = canvas.getContext('2d');
      if (!ctx) return true;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i]! > 0) return false;
      }
      return true;
    });
    expect(slide1IsEmpty).toBe(true);

    // Navigate back to slide 0
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);

    // Canvas should have the previous drawing restored
    const slide0Restored = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const canvas = wb?.shadowRoot?.querySelector('canvas');
      if (!canvas) return false;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      const data = ctx.getImageData(canvas.width * 0.4, canvas.height * 0.4, canvas.width * 0.2, canvas.height * 0.2).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i]! > 0) return true;
      }
      return false;
    });
    expect(slide0Restored).toBe(true);
  });

  test('stroke events carry correct slideIndex', async ({ page }) => {
    // Navigate to slide 1
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);

    // Verify we're on slide 1+ (could be partial)
    const currentSlide = await page.evaluate(
      () => (document.getElementById('slideshow') as any)?.currentSlide,
    );
    expect(currentSlide).toBeGreaterThanOrEqual(1);

    // Activate whiteboard
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('whiteboard');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Listen for stroke event and capture slideIndex
    const strokeIndexPromise = page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const ss = document.getElementById('slideshow');
        const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
        wb?.addEventListener('geek:whiteboard:stroke', (e: Event) => {
          resolve((e as CustomEvent).detail.slideIndex);
        }, { once: true });
        setTimeout(() => resolve(-1), 3000);
      });
    });

    // Draw on canvas
    const canvasBounds = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const canvas = wb?.shadowRoot?.querySelector('canvas');
      const rect = canvas?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
    });
    expect(canvasBounds).toBeTruthy();

    const cx = canvasBounds!.x + canvasBounds!.width * 0.3;
    const cy = canvasBounds!.y + canvasBounds!.height * 0.3;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 50, cy + 50, { steps: 5 });
    await page.mouse.up();

    const slideIndex = await strokeIndexPromise;
    expect(slideIndex).toBe(currentSlide);
  });

  test('auto-activation drag produces a visible stroke', async ({ page }) => {
    // Get container bounds
    const box = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const container = ss?.shadowRoot?.querySelector('.gs-container');
      const rect = container?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
    });
    expect(box).toBeTruthy();

    const startX = box!.x + box!.width * 0.3;
    const startY = box!.y + box!.height * 0.3;
    const endX = box!.x + box!.width * 0.6;
    const endY = box!.y + box!.height * 0.6;

    // Drag to auto-activate and draw
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    // Verify canvas has non-transparent pixels (a stroke was drawn)
    const hasContent = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const canvas = wb?.shadowRoot?.querySelector('canvas');
      if (!canvas) return false;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i]! > 0) return true;
      }
      return false;
    });
    expect(hasContent).toBe(true);
  });

  test('drawing does not change the current slide', async ({ page }) => {
    // Record initial slide
    const slideBefore = await page.evaluate(
      () => (document.getElementById('slideshow') as any)?.currentSlide,
    );

    // Activate whiteboard
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('whiteboard');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Get canvas bounds
    const canvasBounds = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const canvas = wb?.shadowRoot?.querySelector('canvas');
      const rect = canvas?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
    });
    expect(canvasBounds).toBeTruthy();

    // Draw a wide horizontal stroke (would trigger swipe navigation if touch events leak)
    const cx = canvasBounds!.x + canvasBounds!.width * 0.1;
    const cy = canvasBounds!.y + canvasBounds!.height * 0.5;
    const ex = canvasBounds!.x + canvasBounds!.width * 0.9;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(ex, cy, { steps: 15 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Slide should not have changed
    const slideAfter = await page.evaluate(
      () => (document.getElementById('slideshow') as any)?.currentSlide,
    );
    expect(slideAfter).toBe(slideBefore);
  });

  test('drawing works on multiple slides without reload', async ({ page }) => {
    // Activate whiteboard on slide 0
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('whiteboard');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Draw on slide 0
    const stroke0 = page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const wb = document.getElementById('slideshow')?.shadowRoot?.querySelector('geek-whiteboard');
        wb?.addEventListener('geek:whiteboard:stroke', () => resolve(true), { once: true });
        setTimeout(() => resolve(false), 3000);
      });
    });

    const box = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const canvas = wb?.shadowRoot?.querySelector('canvas');
      const rect = canvas?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
    });
    expect(box).toBeTruthy();

    await page.mouse.move(box!.x + box!.width * 0.3, box!.y + box!.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5, { steps: 5 });
    await page.mouse.up();

    expect(await stroke0).toBe(true);

    // Navigate to slide 1
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);

    // Draw on slide 1 (should work without reload)
    const stroke1 = page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const wb = document.getElementById('slideshow')?.shadowRoot?.querySelector('geek-whiteboard');
        wb?.addEventListener('geek:whiteboard:stroke', () => resolve(true), { once: true });
        setTimeout(() => resolve(false), 3000);
      });
    });

    const box1 = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const canvas = wb?.shadowRoot?.querySelector('canvas');
      const rect = canvas?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
    });
    expect(box1).toBeTruthy();

    await page.mouse.move(box1!.x + box1!.width * 0.3, box1!.y + box1!.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box1!.x + box1!.width * 0.5, box1!.y + box1!.height * 0.5, { steps: 5 });
    await page.mouse.up();

    expect(await stroke1).toBe(true);
  });

  test('strokes sync to a second window in the same room', async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    const room = uniqueRoom('wb-sync');
    const url = `/?config=e2e/fixtures/layouts-deck/config.json&room=${room}`;

    await page1.goto(url);
    await page2.goto(url);

    for (const page of [page1, page2]) {
      await page.waitForFunction(() => {
        const ss = document.getElementById('slideshow') as any;
        return ss?.slideCount > 0;
      });
    }

    // Wait for sync connection and content proxy reload
    await page1.waitForTimeout(1500);

    // Verify whiteboard exists in both windows
    for (const page of [page1, page2]) {
      const exists = await page.evaluate(() => {
        const ss = document.getElementById('slideshow');
        return !!ss?.shadowRoot?.querySelector('geek-whiteboard');
      });
      expect(exists).toBe(true);
    }

    // Activate whiteboard and draw on page1
    await page1.keyboard.press('Escape');
    await page1.waitForTimeout(200);
    await page1.keyboard.type('whiteboard');
    await page1.keyboard.press('Enter');
    await page1.waitForTimeout(300);
    await page1.keyboard.press('Escape');
    await page1.waitForTimeout(200);

    const canvasBounds = await page1.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const canvas = wb?.shadowRoot?.querySelector('canvas');
      const rect = canvas?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
    });
    expect(canvasBounds).toBeTruthy();

    const cx = canvasBounds!.x + canvasBounds!.width * 0.3;
    const cy = canvasBounds!.y + canvasBounds!.height * 0.3;
    await page1.mouse.move(cx, cy);
    await page1.mouse.down();
    await page1.mouse.move(cx + 100, cy + 100, { steps: 10 });
    await page1.mouse.up();

    // Wait for sync propagation
    await page2.waitForTimeout(2000);

    // Verify page2 whiteboard auto-showed and has pixels
    const page2State = await page2.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard') as any;
      const canvas = wb?.shadowRoot?.querySelector('canvas');
      if (!canvas) return { visible: false, hasContent: false };
      const ctx = canvas.getContext('2d');
      if (!ctx) return { visible: wb?.isVisible as boolean, hasContent: false };
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i]! > 0) return { visible: wb?.isVisible as boolean, hasContent: true };
      }
      return { visible: wb?.isVisible as boolean, hasContent: false };
    });

    expect(page2State.visible).toBe(true);
    expect(page2State.hasContent).toBe(true);

    await context.close();
  });

  test('live stroke progress appears on remote before stroke is finalized', async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    const room = uniqueRoom('wb-live');
    const url = `/?config=e2e/fixtures/layouts-deck/config.json&room=${room}`;

    await page1.goto(url);
    await page2.goto(url);

    for (const p of [page1, page2]) {
      await p.waitForFunction(() => {
        const ss = document.getElementById('slideshow') as any;
        return ss?.slideCount > 0;
      });
    }

    // Wait for sync connection + content proxy reload
    await page1.waitForTimeout(1500);

    // Activate whiteboard via command on page1
    await page1.keyboard.press('Escape');
    await page1.waitForTimeout(200);
    await page1.keyboard.type('whiteboard');
    await page1.keyboard.press('Enter');
    await page1.waitForTimeout(300);
    await page1.keyboard.press('Escape');
    await page1.waitForTimeout(200);

    const canvasBounds = await page1.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const canvas = wb?.shadowRoot?.querySelector('canvas');
      const rect = canvas?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
    });
    expect(canvasBounds).toBeTruthy();

    // Start drawing on page1 — press down and move, but do NOT release
    const cx = canvasBounds!.x + canvasBounds!.width * 0.3;
    const cy = canvasBounds!.y + canvasBounds!.height * 0.3;
    await page1.mouse.move(cx, cy);
    await page1.mouse.down();
    await page1.mouse.move(cx + 150, cy + 100, { steps: 15 });

    // Wait for at least two progress intervals (100ms each) + sync propagation
    await page2.waitForTimeout(800);

    // Continue drawing more to trigger additional progress emissions
    await page1.mouse.move(cx + 250, cy + 150, { steps: 10 });
    await page2.waitForTimeout(500);

    // Check page2 for pixels WHILE the stroke is still in-progress
    const midDrawPixels = await page2.evaluate(() => {
      const canvas = document.getElementById('slideshow')
        ?.shadowRoot?.querySelector('geek-whiteboard')
        ?.shadowRoot?.querySelector('canvas') as HTMLCanvasElement | null;
      if (!canvas) return 0;
      const ctx = canvas.getContext('2d');
      if (!ctx) return 0;
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let c = 0; for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) c++;
      return c;
    });

    // Now finish the stroke
    await page1.mouse.up();
    await page2.waitForTimeout(1000);

    const finalPixels = await page2.evaluate(() => {
      const canvas = document.getElementById('slideshow')
        ?.shadowRoot?.querySelector('geek-whiteboard')
        ?.shadowRoot?.querySelector('canvas') as HTMLCanvasElement | null;
      if (!canvas) return 0;
      const ctx = canvas.getContext('2d');
      if (!ctx) return 0;
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let c = 0; for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) c++;
      return c;
    });

    // Mid-draw should already have some pixels (progressive sync)
    expect(midDrawPixels).toBeGreaterThan(0);
    // Final should have at least as many
    expect(finalPixels).toBeGreaterThanOrEqual(midDrawPixels);

    await context.close();
  });

  test('toolbar is present and has tool buttons and color swatches', async ({ page }) => {
    // Activate whiteboard
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('whiteboard');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Check toolbar exists inside whiteboard shadow DOM
    const toolbarInfo = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const toolbar = wb?.shadowRoot?.querySelector('geek-whiteboard-toolbar');
      if (!toolbar) return null;
      const shadow = toolbar.shadowRoot;
      const toolBtns = shadow?.querySelectorAll('.tool-btn');
      const swatches = shadow?.querySelectorAll('.swatch');
      const collapseBtn = shadow?.querySelector('.collapse-btn');
      return {
        exists: true,
        toolCount: toolBtns?.length ?? 0,
        swatchCount: swatches?.length ?? 0,
        hasCollapseBtn: !!collapseBtn,
      };
    });

    expect(toolbarInfo).toBeTruthy();
    expect(toolbarInfo?.toolCount).toBe(3);
    expect(toolbarInfo?.swatchCount).toBe(16);
    expect(toolbarInfo?.hasCollapseBtn).toBe(true);
  });

  test('wb-toolbar command toggles toolbar visibility (hidden by default)', async ({ page }) => {
    // Activate whiteboard first
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('whiteboard');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Toolbar starts hidden by default, so first toggle should show it.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('wb-toolbar');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    const shown = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const toolbar = wb?.shadowRoot?.querySelector('geek-whiteboard-toolbar') as any;
      return toolbar?.isHidden === false;
    });
    expect(shown).toBe(true);

    // Second toggle should hide it again.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('wb-toolbar');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    const hiddenAgain = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const toolbar = wb?.shadowRoot?.querySelector('geek-whiteboard-toolbar') as any;
      return toolbar?.isHidden === true;
    });
    expect(hiddenAgain).toBe(true);
  });

  test('wb-hide and wb-show commands control toolbar visibility', async ({ page }) => {
    // Activate whiteboard
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('whiteboard');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Hide toolbar
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('wb-hide');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    const hidden = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const toolbar = wb?.shadowRoot?.querySelector('geek-whiteboard-toolbar') as any;
      return toolbar?.isHidden;
    });
    expect(hidden).toBe(true);

    // Show toolbar
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('wb-show');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    const shown = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const toolbar = wb?.shadowRoot?.querySelector('geek-whiteboard-toolbar') as any;
      return toolbar?.isHidden;
    });
    expect(shown).toBe(false);
  });

  test('wb-pen, wb-highlighter, wb-eraser commands switch tools', async ({ page }) => {
    // Activate whiteboard
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('whiteboard');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Switch to highlighter
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('wb-highlighter');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    const tool1 = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const toolbar = wb?.shadowRoot?.querySelector('geek-whiteboard-toolbar') as any;
      return toolbar?.tool;
    });
    expect(tool1).toBe('highlighter');

    // Switch to eraser
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('wb-eraser');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    const tool2 = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const toolbar = wb?.shadowRoot?.querySelector('geek-whiteboard-toolbar') as any;
      return toolbar?.tool;
    });
    expect(tool2).toBe('eraser');

    // Switch back to pen
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('wb-pen');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    const tool3 = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const toolbar = wb?.shadowRoot?.querySelector('geek-whiteboard-toolbar') as any;
      return toolbar?.tool;
    });
    expect(tool3).toBe('pen');
  });

  test('clicking toolbar color swatch changes drawing color', async ({ page }) => {
    // Activate whiteboard
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('whiteboard');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Click the black swatch (first one)
    await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const toolbar = wb?.shadowRoot?.querySelector('geek-whiteboard-toolbar');
      const swatch = toolbar?.shadowRoot?.querySelector('[data-color="#000000"]') as HTMLButtonElement;
      swatch?.click();
    });
    await page.waitForTimeout(200);

    const color = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const toolbar = wb?.shadowRoot?.querySelector('geek-whiteboard-toolbar') as any;
      return toolbar?.color;
    });
    expect(color).toBe('#000000');
  });

  test('toolbar clear button requires double-click confirmation', async ({ page }) => {
    // Activate whiteboard and draw something
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('whiteboard');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Draw a stroke
    const canvasBounds = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const canvas = wb?.shadowRoot?.querySelector('canvas');
      const rect = canvas?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
    });
    expect(canvasBounds).toBeTruthy();

    await page.mouse.move(canvasBounds!.x + 100, canvasBounds!.y + 100);
    await page.mouse.down();
    await page.mouse.move(canvasBounds!.x + 300, canvasBounds!.y + 300, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    // Click clear once — should enter confirmation state
    const firstClickState = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const toolbar = wb?.shadowRoot?.querySelector('geek-whiteboard-toolbar');
      const clearBtn = toolbar?.shadowRoot?.querySelector('[data-action="clear"]') as HTMLButtonElement;
      clearBtn?.click();
      return clearBtn?.textContent;
    });
    expect(firstClickState).toBe('Clear?');

    // Click clear again — should confirm and clear
    await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const toolbar = wb?.shadowRoot?.querySelector('geek-whiteboard-toolbar');
      const clearBtn = toolbar?.shadowRoot?.querySelector('[data-action="clear"]') as HTMLButtonElement;
      clearBtn?.click();
    });
    await page.waitForTimeout(200);

    // Canvas should be empty
    const isEmpty = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const canvas = wb?.shadowRoot?.querySelector('canvas');
      if (!canvas) return true;
      const ctx = canvas.getContext('2d');
      if (!ctx) return true;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i]! > 0) return false;
      }
      return true;
    });
    expect(isEmpty).toBe(true);
  });

  test('remote strokes survive navigation after live-progress sync', async ({ browser }) => {
    test.setTimeout(30000);
    const context = await browser.newContext();
    const presenter = await context.newPage();
    const viewer = await context.newPage();
    const room = uniqueRoom('wb-nav-live');
    const presenterUrl = `/?config=e2e/fixtures/layouts-deck/config.json&room=${room}`;
    const viewerUrl = `/?config=e2e/fixtures/layouts-deck/config.json&room=${room}&readonly`;

    await presenter.goto(presenterUrl);
    await presenter.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as any;
      return ss?.slideCount > 0;
    });

    // Wait for content proxy before opening viewer
    await presenter.waitForTimeout(2000);

    await viewer.goto(viewerUrl);
    await viewer.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as any;
      return ss?.slideCount > 0;
    });

    // Wait for sync to be established
    await viewer.waitForTimeout(3000);

    // Helper: count non-transparent pixels on the viewer's whiteboard canvas
    function viewerPixelCount(): Promise<number> {
      return viewer.evaluate(() => {
        const canvas = document.getElementById('slideshow')
          ?.shadowRoot?.querySelector('geek-whiteboard')
          ?.shadowRoot?.querySelector('canvas') as HTMLCanvasElement | null;
        if (!canvas) return 0;
        const ctx = canvas.getContext('2d');
        if (!ctx) return 0;
        const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let c = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) c++;
        return c;
      });
    }

    // Helper: poll until viewer pixel count exceeds a threshold
    async function waitForViewerPixels(minPixels: number, timeout = 5000): Promise<number> {
      const start = Date.now();
      let count = 0;
      while (Date.now() - start < timeout) {
        count = await viewerPixelCount();
        if (count > minPixels) return count;
        await viewer.waitForTimeout(200);
      }
      return count;
    }

    // Helper: navigate presenter and wait for viewer to follow
    async function navigateAndWait(key: string, expectedSlide: number): Promise<void> {
      await presenter.keyboard.press(key);
      await presenter.waitForFunction(
        (s: number) => (document.getElementById('slideshow') as any)?.currentSlide === s,
        expectedSlide,
        { timeout: 3000 },
      );
      await viewer.waitForFunction(
        (s: number) => (document.getElementById('slideshow') as any)?.currentSlide === s,
        expectedSlide,
        { timeout: 10000 },
      );
      await viewer.waitForTimeout(300);
    }

    // Helper: draw a stroke on the presenter page
    async function drawOnPresenter(xFrac: number, yFrac: number, dxFrac: number, dyFrac: number): Promise<void> {
      const bounds = await presenter.evaluate(() => {
        const ss = document.getElementById('slideshow');
        const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
        const canvas = wb?.shadowRoot?.querySelector('canvas');
        const rect = canvas?.getBoundingClientRect();
        return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
      });
      if (!bounds) throw new Error('Canvas bounds not found');
      const sx = bounds.x + bounds.width * xFrac;
      const sy = bounds.y + bounds.height * yFrac;
      const ex = bounds.x + bounds.width * (xFrac + dxFrac);
      const ey = bounds.y + bounds.height * (yFrac + dyFrac);
      await presenter.mouse.move(sx, sy);
      await presenter.mouse.down();
      await presenter.mouse.move(ex, ey, { steps: 10 });
      await presenter.mouse.up();
    }

    // Activate whiteboard on presenter
    await presenter.keyboard.press('Escape');
    await presenter.waitForTimeout(200);
    await presenter.keyboard.type('whiteboard');
    await presenter.keyboard.press('Enter');
    await presenter.waitForTimeout(300);
    await presenter.keyboard.press('Escape');
    await presenter.waitForTimeout(200);

    // Draw first stroke on slide 0 and wait for viewer to receive it
    await drawOnPresenter(0.2, 0.2, 0.2, 0.2);
    const afterFirstStroke = await waitForViewerPixels(0);
    expect(afterFirstStroke).toBeGreaterThan(0);

    // Wait for Yjs to finalize the stroke (sync round-trip)
    await presenter.waitForTimeout(1500);

    // Navigate to slide 1 and back to slide 0
    await navigateAndWait('ArrowRight', 1);
    await navigateAndWait('ArrowLeft', 0);

    // Wait for canvas fade-in (500ms transition + buffer)
    await viewer.waitForTimeout(800);

    // First stroke should be restored from snapshot
    const restoredFirst = await viewerPixelCount();
    expect(restoredFirst).toBeGreaterThanOrEqual(afterFirstStroke * 0.9);

    // Draw second stroke on slide 0 and wait for viewer
    await drawOnPresenter(0.5, 0.5, 0.2, 0.2);
    const afterSecondStroke = await waitForViewerPixels(restoredFirst);
    expect(afterSecondStroke).toBeGreaterThan(restoredFirst);

    // Wait for Yjs finalization
    await presenter.waitForTimeout(1500);

    // Navigate away and back once more
    await navigateAndWait('ArrowRight', 1);
    await navigateAndWait('ArrowLeft', 0);

    // Wait for canvas fade-in
    await viewer.waitForTimeout(800);

    // After restoring, viewer must still show ALL strokes from slide 0
    const afterRestore = await viewerPixelCount();
    expect(afterRestore).toBeGreaterThanOrEqual(afterSecondStroke * 0.9);

    await context.close();
  });

  test('readonly viewer cannot draw or toggle but sees remote strokes', async ({ browser }) => {
    const context = await browser.newContext();
    const room = uniqueRoom('wb-readonly');

    // Presenter tab
    const presenter = await context.newPage();
    await presenter.goto(`/?config=e2e/fixtures/layouts-deck/config.json&room=${room}`);
    await presenter.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as unknown as { slideCount: number } | null;
      return ss !== null && ss.slideCount > 0;
    });

    // Wait for content proxy upload
    await presenter.waitForTimeout(2000);

    // Readonly viewer tab
    const viewer = await context.newPage();
    await viewer.goto(`/?config=e2e/fixtures/layouts-deck/config.json&room=${room}&readonly`);
    await viewer.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as unknown as { slideCount: number } | null;
      return ss !== null && ss.slideCount > 0;
    });
    await viewer.waitForTimeout(2000);

    // --- Verify viewer has a readonly whiteboard ---
    const viewerHasReadonlyWb = await viewer.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      return wb?.hasAttribute('readonly') === true;
    });
    expect(viewerHasReadonlyWb).toBe(true);

    // --- Verify viewer whiteboard starts hidden ---
    const viewerWbHidden = await viewer.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard') as HTMLElement & { isVisible: boolean } | null;
      return wb?.isVisible === false;
    });
    expect(viewerWbHidden).toBe(true);

    // --- Verify drag on viewer does NOT activate whiteboard ---
    const viewerBox = await viewer.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const container = ss?.shadowRoot?.querySelector('.gs-container');
      const rect = container?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
    });
    expect(viewerBox).toBeTruthy();

    const vx1 = viewerBox!.x + viewerBox!.width * 0.3;
    const vy1 = viewerBox!.y + viewerBox!.height * 0.3;
    const vx2 = viewerBox!.x + viewerBox!.width * 0.5;
    const vy2 = viewerBox!.y + viewerBox!.height * 0.5;

    await viewer.mouse.move(vx1, vy1);
    await viewer.mouse.down();
    await viewer.mouse.move(vx2, vy2, { steps: 5 });
    await viewer.mouse.up();
    await viewer.waitForTimeout(300);

    const viewerStillHidden = await viewer.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard') as HTMLElement & { isVisible: boolean } | null;
      return wb?.isVisible === false;
    });
    expect(viewerStillHidden).toBe(true);

    // --- Presenter draws a stroke → viewer should auto-show it ---
    // Activate whiteboard on presenter
    await presenter.keyboard.press('Escape');
    await presenter.waitForTimeout(200);
    await presenter.keyboard.type('whiteboard');
    await presenter.keyboard.press('Enter');
    await presenter.waitForTimeout(300);
    await presenter.keyboard.press('Escape');
    await presenter.waitForTimeout(200);

    // Draw on presenter canvas
    const presenterCanvasBounds = await presenter.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const canvas = wb?.shadowRoot?.querySelector('canvas');
      const rect = canvas?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
    });
    expect(presenterCanvasBounds).toBeTruthy();

    const px1 = presenterCanvasBounds!.x + presenterCanvasBounds!.width * 0.3;
    const py1 = presenterCanvasBounds!.y + presenterCanvasBounds!.height * 0.3;
    const px2 = presenterCanvasBounds!.x + presenterCanvasBounds!.width * 0.7;
    const py2 = presenterCanvasBounds!.y + presenterCanvasBounds!.height * 0.7;

    await presenter.mouse.move(px1, py1);
    await presenter.mouse.down();
    await presenter.mouse.move(px2, py2, { steps: 10 });
    await presenter.mouse.up();

    // Wait for Yjs sync to propagate the stroke
    await viewer.waitForTimeout(2000);

    // Viewer whiteboard should now be visible with rendered content
    const viewerWbVisibleWithContent = await viewer.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard') as HTMLElement & { isVisible: boolean } | null;
      if (!wb?.isVisible) return false;
      const canvas = wb.shadowRoot?.querySelector('canvas');
      if (!canvas) return false;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i]! > 0) return true;
      }
      return false;
    });
    expect(viewerWbVisibleWithContent).toBe(true);

    await context.close();
  });
});

// ---------------------------------------------------------------------------
// Overview / whiteboard interaction
// ---------------------------------------------------------------------------

test.describe('Whiteboard + Overview interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/?config=e2e/fixtures/layouts-deck/config.json&room=${uniqueRoom('wb-overview')}`);
    await page.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as any;
      return ss?.slideCount > 0;
    });
  });

  test('entering overview mode hides whiteboard canvas and toolbar', async ({ page }) => {
    // Activate whiteboard
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('whiteboard');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    const visibleBefore = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard') as any;
      return wb?.isVisible === true;
    });
    expect(visibleBefore).toBe(true);

    // Enter overview
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('overview');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // The features container must be display:none in overview
    const featuresHidden = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const features = ss?.shadowRoot?.querySelector('.gs-features') as HTMLElement | null;
      if (!features) return false;
      const style = getComputedStyle(features);
      return style.display === 'none';
    });
    expect(featuresHidden).toBe(true);
  });

  test('clicking a thumbnail exits overview and navigates to correct slide', async ({ page }) => {
    // Advance past first slide so we have somewhere to navigate back from
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);

    // Enter overview
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('overview');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    const mode = await page.evaluate(() => (document.getElementById('slideshow') as any)?.mode);
    expect(mode).toBe('overview');

    // Click the first thumbnail (slide 0)
    await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const firstSlide = ss?.shadowRoot?.querySelectorAll('geek-slide')[0] as HTMLElement | undefined;
      firstSlide?.click();
    });
    await page.waitForTimeout(400);

    const state = await page.evaluate(() => {
      const ss = document.getElementById('slideshow') as any;
      return { mode: ss?.mode, slide: ss?.currentSlide };
    });
    expect(state.mode).toBe('present');
    expect(state.slide).toBe(0);
  });

  test('whiteboard canvas pointer-events pass through when toolbar is collapsed', async ({ page }) => {
    // Activate whiteboard
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('whiteboard');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Collapse toolbar by clicking the ≡ collapse button in the toolbar shadow DOM
    await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const toolbar = wb?.shadowRoot?.querySelector('geek-whiteboard-toolbar');
      const collapseBtn = toolbar?.shadowRoot?.querySelector<HTMLButtonElement>('.collapse-btn');
      collapseBtn?.click();
    });
    await page.waitForTimeout(300);

    // Verify canvas has pointer-events:none
    const canvasPointerEvents = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const canvas = wb?.shadowRoot?.querySelector<HTMLCanvasElement>('canvas.main');
      return canvas?.style.pointerEvents ?? null;
    });
    expect(canvasPointerEvents).toBe('none');

    // Verify slide navigation still works via keyboard (arrow key advances slide)
    const slideBefore = await page.evaluate(() => (document.getElementById('slideshow') as any)?.currentSlide);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    const slideAfter = await page.evaluate(() => (document.getElementById('slideshow') as any)?.currentSlide);
    expect(slideAfter).toBeGreaterThan(slideBefore);
  });

  test('whiteboard does not auto-activate on drag during overview mode', async ({ page }) => {
    // Enter overview
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('overview');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    const box = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const container = ss?.shadowRoot?.querySelector('.gs-container');
      const rect = container?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
    });
    expect(box).toBeTruthy();

    // Drag across the container (would auto-activate in present mode)
    await page.mouse.move(box!.x + box!.width * 0.3, box!.y + box!.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.6, box!.y + box!.height * 0.5, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    const wbActive = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard') as any;
      return wb?.isVisible === true;
    });
    expect(wbActive).toBe(false);
  });

  test('whiteboard content still visible after slide navigation while toolbar collapsed', async ({ page }) => {
    // Activate whiteboard and draw
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('whiteboard');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    const canvasBounds = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const canvas = wb?.shadowRoot?.querySelector('canvas');
      const rect = canvas?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
    });
    expect(canvasBounds).toBeTruthy();

    await page.mouse.move(canvasBounds!.x + canvasBounds!.width * 0.2, canvasBounds!.y + canvasBounds!.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(canvasBounds!.x + canvasBounds!.width * 0.5, canvasBounds!.y + canvasBounds!.height * 0.6, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    // Collapse the toolbar via the ≡ collapse button (not wb-toolbar — that hides completely)
    await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const toolbar = wb?.shadowRoot?.querySelector('geek-whiteboard-toolbar');
      const collapseBtn = toolbar?.shadowRoot?.querySelector<HTMLButtonElement>('.collapse-btn');
      collapseBtn?.click();
    });
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Navigate away then back
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(600);

    // Canvas must still be displayed with its strokes
    const state = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const canvas = wb?.shadowRoot?.querySelector<HTMLCanvasElement>('canvas.main');
      if (!canvas) return { display: 'missing', hasContent: false, pointerEvents: '' };
      const ctx = canvas.getContext('2d');
      let hasContent = false;
      if (ctx) {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i]! > 0) { hasContent = true; break; }
        }
      }
      return { display: canvas.style.display, hasContent, pointerEvents: canvas.style.pointerEvents };
    });

    expect(state.display).not.toBe('none');
    expect(state.hasContent).toBe(true);
    // Touch pass-through must still be active
    expect(state.pointerEvents).toBe('none');
  });

  test('whiteboard resumes correctly after returning from overview', async ({ page }) => {
    // Activate whiteboard and draw
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('whiteboard');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    const canvasBounds = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const canvas = wb?.shadowRoot?.querySelector('canvas');
      const rect = canvas?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
    });
    expect(canvasBounds).toBeTruthy();

    await page.mouse.move(canvasBounds!.x + canvasBounds!.width * 0.2, canvasBounds!.y + canvasBounds!.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(canvasBounds!.x + canvasBounds!.width * 0.5, canvasBounds!.y + canvasBounds!.height * 0.6, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    // Enter and exit overview (click first thumbnail)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('overview');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const firstSlide = ss?.shadowRoot?.querySelectorAll('geek-slide')[0] as HTMLElement | undefined;
      firstSlide?.click();
    });
    await page.waitForTimeout(500);

    // Whiteboard canvas should still have its strokes (drawing not cleared by overview)
    const hasContent = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const canvas = wb?.shadowRoot?.querySelector<HTMLCanvasElement>('canvas.main');
      if (!canvas) return false;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i]! > 0) return true;
      }
      return false;
    });
    expect(hasContent).toBe(true);
  });

  test('wb-toolbar command completely shows and hides the toolbar', async ({ page }) => {
    // Activate whiteboard (toolbar should remain hidden by default)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('whiteboard');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Verify toolbar is hidden initially
    const toolbarHiddenInitially = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const toolbar = wb?.shadowRoot?.querySelector('geek-whiteboard-toolbar') as any;
      return toolbar?.isHidden === true;
    });
    expect(toolbarHiddenInitially).toBe(true);

    // Run wb-toolbar to show the toolbar
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('wb-toolbar');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Toolbar should now be visible
    const toolbarShownAfterCommand = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const toolbar = wb?.shadowRoot?.querySelector('geek-whiteboard-toolbar') as any;
      return toolbar?.isHidden === false;
    });
    expect(toolbarShownAfterCommand).toBe(true);

    // Run wb-toolbar again to hide it
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.type('wb-toolbar');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Toolbar should be hidden again
    const toolbarHiddenAgain = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard');
      const toolbar = wb?.shadowRoot?.querySelector('geek-whiteboard-toolbar') as any;
      return toolbar?.isHidden === true;
    });
    expect(toolbarHiddenAgain).toBe(true);
  });

  test('whiteboard strokes persist after page reload', async ({ browser }) => {
    const context = await browser.newContext();
    const room = uniqueRoom('wb-persist');
    const page = await context.newPage();

    await page.goto(`/?config=e2e/fixtures/layouts-deck/config.json&room=${room}`);
    await page.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as any;
      return ss?.slideCount > 0;
    }, undefined, { timeout: 10000 });

    // Wait for whiteboard feature and Yjs sync
    await page.waitForFunction(() => {
      const ss = document.getElementById('slideshow');
      return !!ss?.shadowRoot?.querySelector('geek-whiteboard');
    }, undefined, { timeout: 10000 });
    await page.waitForTimeout(2000); // Wait for Yjs sync + upload

    // Draw a stroke via the whiteboard command + drag
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.keyboard.type('whiteboard');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Draw a line
    const box = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      const container = ss?.shadowRoot?.querySelector('.gs-container');
      const rect = container?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : null;
    });
    expect(box).not.toBeNull();

    await page.mouse.move(box!.x + box!.w * 0.3, box!.y + box!.h * 0.5);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.w * 0.7, box!.y + box!.h * 0.5, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Verify stroke was stored in Yjs
    const strokeCountBeforeReload = await page.evaluate(() => {
      const sync = (window as any).__geekslides_sync;
      if (!sync) return 0;
      const features = sync.doc.getMap('features');
      const wbMap = features.get('whiteboard');
      if (!wbMap) return 0;
      const items = wbMap.get('items');
      return items ? items.length : 0;
    });
    expect(strokeCountBeforeReload).toBeGreaterThan(0);

    // Open a peer page in the same room to keep the Yjs doc alive on the server
    // (y-websocket drops docs when the last client disconnects)
    const peerPage = await context.newPage();
    await peerPage.goto(`/?config=e2e/fixtures/layouts-deck/config.json&room=${room}`);
    await peerPage.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as any;
      return ss?.slideCount > 0;
    }, undefined, { timeout: 10000 });
    // Wait for peer to sync the Yjs state from server
    await peerPage.waitForFunction(() => {
      const sync = (window as any).__geekslides_sync;
      if (!sync) return false;
      const features = sync.doc.getMap('features');
      const wbMap = features.get('whiteboard');
      if (!wbMap) return false;
      const items = wbMap.get('items');
      return items && items.length > 0;
    }, undefined, { timeout: 10000 });

    // Reload the main page (peer keeps room alive)
    await page.reload();
    await page.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as any;
      return ss?.slideCount > 0;
    }, undefined, { timeout: 10000 });

    // Wait for Yjs to sync strokes back from server (poll until they appear)
    await page.waitForFunction((expected: number) => {
      const sync = (window as any).__geekslides_sync;
      if (!sync) return false;
      const features = sync.doc.getMap('features');
      const wbMap = features.get('whiteboard');
      if (!wbMap) return false;
      const items = wbMap.get('items');
      return items && items.length >= expected;
    }, strokeCountBeforeReload, { timeout: 15000 });

    // Verify whiteboard canvas has content (strokes were drawn after Yjs sync)
    await page.waitForFunction(() => {
      const ss = document.getElementById('slideshow');
      const wb = ss?.shadowRoot?.querySelector('geek-whiteboard') as any;
      if (!wb?.shadowRoot) return false;
      const canvas = wb.shadowRoot.querySelector('canvas');
      if (!canvas) return false;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) return true;
      }
      return false;
    }, undefined, { timeout: 10000 });

    await peerPage.close();
    await context.close();
  });
});
