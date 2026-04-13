import { test, expect } from '@playwright/test';

function uniqueRoom(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

test.describe('Speaker View', () => {
  test('speaker view renders with timer and notes', async ({ page }) => {
    await page.goto(`/?view=speaker&room=${uniqueRoom('speaker')}`);
    await page.waitForFunction(() => {
      const sv = document.querySelector('geek-speaker-view') as any;
      return sv?.currentIndex !== undefined;
    }, { timeout: 5000 });

    // Speaker view should exist and be visible
    const speakerEl = page.locator('geek-speaker-view');
    await expect(speakerEl).toBeVisible();

    // Timer should be running (check shadow DOM text)
    const timerText = await page.evaluate(() => {
      const sv = document.querySelector('geek-speaker-view');
      return sv?.shadowRoot?.querySelector('.timer')?.textContent ?? '';
    });
    // Timer is formatted as HH:MM:SS
    expect(timerText).toMatch(/\d{2}:\d{2}:\d{2}/);

    const layout = await page.evaluate(() => {
      const sv = document.querySelector('geek-speaker-view');
      const shadow = sv?.shadowRoot;
      const notes = shadow?.querySelector('.notes');
      const currentCard = shadow?.querySelector('.current-card');
      const nextCard = shadow?.querySelector('.next-card');
      const currentViewport = shadow?.querySelector('.current-card .viewport');
      const nextViewport = shadow?.querySelector('.next-card .viewport');
      const currentStage = shadow?.querySelector('.current-card .stage');
      const nextStage = shadow?.querySelector('.next-card .stage');
      const currentSlide = shadow?.querySelector('.current-card geek-slide') as HTMLElement | null;
      const nextSlide = shadow?.querySelector('.next-card geek-slide') as HTMLElement | null;

      if (!(notes && currentCard && nextCard && currentViewport && nextViewport && currentStage && nextStage && currentSlide && nextSlide)) {
        return null;
      }

      const notesRect = notes.getBoundingClientRect();
      const currentRect = currentCard.getBoundingClientRect();
      const nextRect = nextCard.getBoundingClientRect();
      const currentViewportRect = currentViewport.getBoundingClientRect();
      const nextViewportRect = nextViewport.getBoundingClientRect();
      const currentStageRect = currentStage.getBoundingClientRect();
      const nextStageRect = nextStage.getBoundingClientRect();

      return {
        notesRight: notesRect.right,
        currentLeft: currentRect.left,
        currentTop: currentRect.top,
        nextLeft: nextRect.left,
        nextTop: nextRect.top,
        currentViewportRect,
        nextViewportRect,
        currentStageRect,
        nextStageRect,
        currentText: currentSlide.shadowRoot?.querySelector('section.content')?.textContent ?? '',
        nextText: nextSlide.shadowRoot?.querySelector('section.content')?.textContent ?? '',
      };
    });

    expect(layout).not.toBeNull();
    expect(layout!.notesRight).toBeLessThan(layout!.currentLeft);
    expect(Math.abs(layout!.currentLeft - layout!.nextLeft)).toBeLessThan(2);
    expect(layout!.nextTop).toBeGreaterThan(layout!.currentTop);
    expect(layout!.currentText.trim().length).toBeGreaterThan(0);
    expect(layout!.nextText.trim().length).toBeGreaterThan(0);
    expect(layout!.currentStageRect.width).toBeLessThanOrEqual(layout!.currentViewportRect.width + 1);
    expect(layout!.currentStageRect.height).toBeLessThanOrEqual(layout!.currentViewportRect.height + 1);
    expect(layout!.nextStageRect.width).toBeLessThanOrEqual(layout!.nextViewportRect.width + 1);
    expect(layout!.nextStageRect.height).toBeLessThanOrEqual(layout!.nextViewportRect.height + 1);
  });

  test('arrow keys navigate in speaker view', async ({ page }) => {
    await page.goto(`/?view=speaker&room=${uniqueRoom('speaker')}`);
    await page.waitForFunction(() => {
      const sv = document.querySelector('geek-speaker-view') as any;
      return sv?.currentIndex !== undefined;
    });

    const before = await page.evaluate(() => {
      const sv = document.querySelector('geek-speaker-view') as any;
      return {
        currentIndex: sv?.currentIndex ?? 0,
        slideCount: (sv?.shadowRoot?.querySelector('.counter')?.textContent ?? '').split('/')[1]?.trim(),
      };
    });

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);

    const current = await page.evaluate(
      () => (document.querySelector('geek-speaker-view') as any)?.currentIndex,
    );
    const slideCount = Number(before.slideCount || '0');
    expect(current).toBe(Math.min(before.currentIndex + 1, Math.max(slideCount - 1, 0)));
  });

  test('slide counter updates on navigation', async ({ page }) => {
    await page.goto(`/?view=speaker&room=${uniqueRoom('speaker')}`);
    await page.waitForFunction(() => {
      const sv = document.querySelector('geek-speaker-view') as any;
      return sv?.currentIndex !== undefined;
    });

    const before = await page.evaluate(() => {
      const sv = document.querySelector('geek-speaker-view');
      const currentIndex = (sv as any)?.currentIndex ?? 0;
      return {
        counter: sv?.shadowRoot?.querySelector('.counter')?.textContent ?? '',
        currentIndex,
      };
    });
    expect(before.counter).toContain(`${String(before.currentIndex + 1)} /`);

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);

    const after = await page.evaluate(() => {
      const sv = document.querySelector('geek-speaker-view');
      const currentIndex = (sv as any)?.currentIndex ?? 0;
      return {
        counter: sv?.shadowRoot?.querySelector('.counter')?.textContent ?? '',
        currentIndex,
      };
    });
    expect(after.currentIndex).toBeGreaterThanOrEqual(before.currentIndex);
    expect(after.counter).toContain(`${String(after.currentIndex + 1)} /`);
  });

  test('speaker previews show unrevealed partials as lighter content', async ({ page }) => {
    await page.goto(`/?view=speaker&room=${uniqueRoom('speaker')}`);
    await page.waitForFunction(() => {
      const sv = document.querySelector('geek-speaker-view') as any;
      return sv?.currentIndex !== undefined;
    });

    const partialState = await page.evaluate(() => {
      const sv = document.querySelector('geek-speaker-view') as any;
      sv?.updateSlide(4, 2);

      const shadow = sv?.shadowRoot;
      const currentSlide = shadow?.querySelector('.current-card geek-slide') as HTMLElement | null;
      const nextSlide = shadow?.querySelector('.next-card geek-slide') as HTMLElement | null;
      if (!(currentSlide && nextSlide)) {
        return null;
      }

      const currentPartials = Array.from(currentSlide.shadowRoot?.querySelectorAll('.gs-partial') ?? []);
      const nextPartials = Array.from(nextSlide.shadowRoot?.querySelectorAll('.gs-partial') ?? []);

      return {
        current: currentPartials.map((el) => {
          const styles = getComputedStyle(el as Element);
          return {
            opacity: styles.opacity,
            visibility: styles.visibility,
            visibleClass: (el as Element).classList.contains('gs-visible'),
          };
        }),
        next: nextPartials.map((el) => {
          const styles = getComputedStyle(el as Element);
          return {
            opacity: styles.opacity,
            visibility: styles.visibility,
            visibleClass: (el as Element).classList.contains('gs-visible'),
          };
        }),
        titleColor: (() => {
          const title = currentSlide.shadowRoot?.querySelector('h3');
          return title ? getComputedStyle(title).color : null;
        })(),
      };
    });

    expect(partialState).not.toBeNull();
    expect(partialState!.titleColor).toBe('rgb(0, 0, 0)');
    expect(partialState!.current.length).toBeGreaterThan(2);
    expect(partialState!.current[0]?.visibleClass).toBe(true);
    expect(partialState!.current[0]?.opacity).toBe('1');
    expect(partialState!.current[1]?.visibleClass).toBe(true);
    expect(partialState!.current[1]?.opacity).toBe('1');
    expect(partialState!.current[2]?.visibleClass).toBe(false);
    expect(partialState!.current[2]?.visibility).toBe('visible');
    expect(Number(partialState!.current[2]?.opacity ?? '1')).toBeLessThan(1);
    expect(partialState!.next.length).toBeGreaterThan(0);
    expect(partialState!.next[0]?.visibleClass).toBe(false);
    expect(partialState!.next[0]?.visibility).toBe('visible');
    expect(Number(partialState!.next[0]?.opacity ?? '1')).toBeLessThan(1);
  });
});
