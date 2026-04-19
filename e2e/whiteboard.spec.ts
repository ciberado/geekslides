import { test, expect } from '@playwright/test';

function uniqueRoom(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

test.describe('Whiteboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`http://localhost:5173/?room=${uniqueRoom('whiteboard')}`);
    await page.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as any;
      return ss?.slideCount > 0;
    });
  });

  test('whiteboard command toggles canvas overlay', async ({ page }) => {
    // Open terminal and run whiteboard command
    await page.keyboard.press('t');
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
    await page.keyboard.press('t');
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
    await page.keyboard.press('t');
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
    await page.keyboard.press('t');
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
    await page.keyboard.press('t');
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
    await page.keyboard.press('t');
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

  test('strokes sync to a second window in the same room', async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    const room = uniqueRoom('wb-sync');
    const url = `http://localhost:5173/?room=${room}`;

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
    await page1.keyboard.press('t');
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
});
