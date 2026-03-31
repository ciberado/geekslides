# Testing Strategy

## Overview

v2 is fully testable with two complementary testing layers:

- **Vitest** — Unit and integration tests (fast, Vite-native, runs in Node or browser mode)
- **Playwright** — End-to-end browser tests (real browser, full interaction flows)

## Test Pyramid

```
          ┌─────────┐
          │   E2E   │   ~15 tests   Playwright
          │ (slow)  │   Full user flows in real browser
          ├─────────┤
          │ Integr. │   ~30 tests   Vitest (browser mode)
          │         │   Component interactions, DOM rendering
          ├─────────┤
          │  Unit   │   ~80+ tests  Vitest (Node)
          │ (fast)  │   Pure logic: parsing, commands, plugins
          └─────────┘
```

## Vitest Configuration

```typescript
// vitest.config.ts (root)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Default: node environment for unit tests
    environment: 'node',
    
    // Workspace-aware: test all packages
    include: ['packages/*/tests/**/*.test.ts'],
    
    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
```

### Browser Mode for Integration Tests

Integration tests that need real DOM (Web Components, Shadow DOM) use Vitest's browser mode:

```typescript
// vitest.config.browser.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: 'playwright',
      name: 'chromium',
    },
    include: ['packages/engine/tests/integration/**/*.test.ts'],
  },
});
```

## Unit Tests (@geekslides/engine)

### SlideParser

```typescript
// packages/engine/tests/unit/SlideParser.test.ts
import { describe, it, expect } from 'vitest';
import { SlideParser } from '../../src/core/SlideParser';

describe('SlideParser', () => {
  const parser = new SlideParser();

  it('splits markdown into slides on empty links', () => {
    const md = `
# Intro

Some text

[](.topic#slide-2)

## Slide 2

More text
    `.trim();

    const slides = parser.parse(md);
    expect(slides).toHaveLength(2);
    expect(slides[0].html).toContain('<h1>Intro</h1>');
    expect(slides[1].html).toContain('<h2>Slide 2</h2>');
  });

  it('extracts slide attributes from empty links', () => {
    const md = '[](.highlight#intro,bgurl(hero.jpg),bgcolor(#333))\n\n## Intro';
    const slides = parser.parse(md);
    
    expect(slides[0].classes).toContain('highlight');
    expect(slides[0].id).toBe('intro');
    expect(slides[0].backgroundImage).toBe('hero.jpg');
    expect(slides[0].backgroundColor).toBe('#333');
  });

  it('extracts speaker notes from ::: Notes container', () => {
    const md = '## My Slide\n\nContent\n\n::: Notes\nThese are notes\n:::';
    const slides = parser.parse(md);
    
    expect(slides[0].notes).toContain('These are notes');
    expect(slides[0].html).not.toContain('These are notes');
  });

  it('extracts per-slide style blocks', () => {
    const md = '## Styled\n\n<style>\nh2 { color: red; }\n</style>\n\nContent';
    const slides = parser.parse(md);
    
    expect(slides[0].rawCss).toBe('h2 { color: red; }');
    expect(slides[0].html).not.toContain('<style>');
  });

  it('handles partials (elements with [partial] attribute)', () => {
    const md = '## Slide\n\n- Item 1\n- Item 2 [partial]\n- Item 3 [partial]';
    const slides = parser.parse(md);
    
    expect(slides[0].partialCount).toBe(2);
  });
});
```

### StyleScoper

```typescript
// packages/engine/tests/unit/StyleScoper.test.ts
import { describe, it, expect } from 'vitest';
import { StyleScoper } from '../../src/core/StyleScoper';

describe('StyleScoper', () => {
  const scoper = new StyleScoper();

  it('prefixes simple selectors with slide container', () => {
    const result = scoper.scope('h2 { color: red; }', 'slide-1');
    expect(result).toContain('geek-slide[data-id="slide-1"] h2');
  });

  it('prefixes compound selectors', () => {
    const result = scoper.scope('.box > .title { font-size: 2em; }', 'slide-2');
    expect(result).toContain('geek-slide[data-id="slide-2"] .box > .title');
  });

  it('does not double-prefix already scoped selectors', () => {
    const result = scoper.scope('geek-slide h2 { color: red; }', 'slide-1');
    expect(result).not.toContain('geek-slide[data-id="slide-1"] geek-slide');
  });

  it('preserves @keyframes and @media rules', () => {
    const css = '@keyframes fade { from { opacity: 0 } to { opacity: 1 } }';
    const result = scoper.scope(css, 'slide-1');
    expect(result).toContain('@keyframes');
  });
});
```

### CommandSystem

```typescript
// packages/engine/tests/unit/CommandSystem.test.ts
import { describe, it, expect, vi } from 'vitest';
import { CommandSystem } from '../../src/input/CommandSystem';

describe('CommandSystem', () => {
  it('registers and executes commands', () => {
    const system = new CommandSystem();
    const fn = vi.fn();
    
    system.register({ name: 'test', label: 'Test', execute: fn });
    system.execute('test');
    
    expect(fn).toHaveBeenCalledOnce();
  });

  it('warns on unknown command', () => {
    const system = new CommandSystem();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    system.execute('nonexistent');
    
    expect(warn).toHaveBeenCalledWith('Unknown command: nonexistent');
    warn.mockRestore();
  });

  it('fuzzy searches commands by label and name', () => {
    const system = new CommandSystem();
    system.register({ name: 'toggle-speaker', label: 'Toggle Speaker Mode', execute: () => {} });
    system.register({ name: 'toggle-overview', label: 'Toggle Overview', execute: () => {} });
    system.register({ name: 'next', label: 'Next Slide', execute: () => {} });

    expect(system.search('toggle')).toHaveLength(2);
    expect(system.search('speaker')).toHaveLength(1);
    expect(system.search('next')).toHaveLength(1);
  });
});
```

### PluginManager

```typescript
// packages/engine/tests/unit/PluginManager.test.ts
import { describe, it, expect } from 'vitest';
import { PluginManager } from '../../src/plugins/PluginManager';

describe('PluginManager', () => {
  it('runs preprocessors in sequence', () => {
    const plugins = new PluginManager();
    
    plugins.register({
      name: 'upper',
      preprocessors: [(md) => md.toUpperCase()],
    });
    plugins.register({
      name: 'prefix',
      preprocessors: [(md) => `PREFIX: ${md}`],
    });

    const result = plugins.preprocess('hello', {} as any);
    expect(result).toBe('PREFIX: HELLO');
  });

  it('runs processors on slide elements', () => {
    const plugins = new PluginManager();
    
    plugins.register({
      name: 'test',
      processors: [(el) => { el.dataset.processed = 'true'; }],
    });

    const el = document.createElement('div');
    plugins.process(el, { slideIndex: 0, slideCount: 1 } as any);
    
    expect(el.dataset.processed).toBe('true');
  });
});
```

## Unit Tests (@geekslides/server)

```typescript
// packages/server/tests/rooms.test.ts
import { describe, it, expect } from 'vitest';

describe('Room auth', () => {
  it('allows connection with valid room name', () => {
    // Test the auth callback logic
  });

  it('rejects connection without room name', () => {
    // Test WebSocket close with 4001
  });

  it('rejects unauthorized token', () => {
    // Test WebSocket close with 4003
  });
});
```

## Integration Tests (Vitest Browser Mode)

```typescript
// packages/engine/tests/integration/Slideshow.test.ts
import { describe, it, expect, beforeEach } from 'vitest';

describe('GeekSlideshow', () => {
  let slideshow: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    slideshow = document.createElement('geek-slideshow');
    document.body.appendChild(slideshow);
  });

  it('renders slides from parsed markdown', async () => {
    // Parse markdown, load into slideshow
    // Assert <geek-slide> elements are created
    // Assert first slide is active
  });

  it('navigates forward through partials then slides', async () => {
    // Load a presentation with partials
    // Call next() multiple times
    // Assert partial reveals, then slide transitions
  });

  it('applies per-slide scoped styles', async () => {
    // Load a slide with <style> block
    // Assert computed style is applied to that slide
    // Assert other slides are NOT affected
  });

  it('responds to custom events', async () => {
    // Dispatch 'geek:navigate' event
    // Assert slideshow moves to correct position
  });
});
```

```typescript
// packages/engine/tests/integration/SyncManager.test.ts
import { describe, it, expect } from 'vitest';

describe('SyncManager', () => {
  it('publishes state changes to Y.Map', () => {
    // Create SyncManager without server connection
    // Call publishState
    // Assert Y.Map values
  });

  it('receives remote state changes and updates slideshow', () => {
    // Create two Y.Docs
    // Modify one, observe the other
    // Assert slideshow.goTo was called
  });
});
```

## E2E Tests (Playwright)

```typescript
// e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],
});
```

### Navigation E2E

```typescript
// e2e/navigation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Slide Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('geek-slideshow');
  });

  test('arrow right advances to next slide', async ({ page }) => {
    await page.keyboard.press('ArrowRight');
    const slide = await page.getAttribute('geek-slide[active]', 'data-id');
    expect(slide).toBe('slide-1');
  });

  test('swipe left advances on mobile', async ({ page }) => {
    const box = await page.locator('geek-slideshow').boundingBox();
    await page.touchscreen.tap(box!.x + box!.width * 0.8, box!.y + box!.height / 2);
    // Perform swipe gesture
    await page.mouse.move(box!.x + box!.width * 0.2, box!.y + box!.height / 2);
  });

  test('keyboard navigates through partials before advancing', async ({ page }) => {
    // Navigate to a slide with partials
    // Press right arrow multiple times
    // Assert partial visibility, then slide change
  });
});
```

### Command System E2E

```typescript
// e2e/commands.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Command System', () => {
  test('Ctrl+B then s toggles speaker mode', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+b');
    await page.keyboard.press('s');
    
    const mode = await page.getAttribute('geek-slideshow', 'mode');
    expect(mode).toBe('speaker');
  });

  test('colon opens command palette', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press(':');
    
    await expect(page.locator('geek-command-palette')).toBeVisible();
  });

  test('command palette filters and executes', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press(':');
    await page.keyboard.type('speaker');
    await page.keyboard.press('Enter');
    
    const mode = await page.getAttribute('geek-slideshow', 'mode');
    expect(mode).toBe('speaker');
  });
});
```

### Sync E2E

```typescript
// e2e/sync.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Real-time Sync', () => {
  test('two browsers sync slide position via Yjs', async ({ browser }) => {
    const presenter = await browser.newPage();
    const audience = await browser.newPage();

    await presenter.goto('/?room=test-room&role=presenter');
    await audience.goto('/?room=test-room');

    // Wait for both to connect
    await presenter.waitForSelector('[data-sync="connected"]');
    await audience.waitForSelector('[data-sync="connected"]');

    // Presenter navigates
    await presenter.keyboard.press('ArrowRight');

    // Audience follows
    await expect(audience.locator('geek-slide[active]')).toHaveAttribute('data-id', 'slide-1');
  });
});
```

### Whiteboard E2E

```typescript
// e2e/whiteboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Whiteboard', () => {
  test('toggles whiteboard overlay', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+b');
    await page.keyboard.press('w');
    
    await expect(page.locator('geek-whiteboard')).toBeVisible();
  });

  test('draws strokes with mouse', async ({ page }) => {
    await page.goto('/');
    // Open whiteboard
    await page.keyboard.press('Control+b');
    await page.keyboard.press('w');

    // Draw a line
    const canvas = page.locator('geek-whiteboard canvas');
    const box = await canvas.boundingBox();
    await page.mouse.move(box!.x + 50, box!.y + 50);
    await page.mouse.down();
    await page.mouse.move(box!.x + 200, box!.y + 200);
    await page.mouse.up();

    // Assert stroke was drawn (check canvas is not blank)
  });
});
```

## CI Integration

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run typecheck
      - run: npm test -- --coverage

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## npm Scripts Summary

```jsonc
{
  "scripts": {
    "test": "vitest run",                    // all unit + integration tests
    "test:watch": "vitest",                  // watch mode
    "test:coverage": "vitest run --coverage", // with coverage report
    "test:browser": "vitest run -c vitest.config.browser.ts", // integration (browser)
    "test:e2e": "playwright test",            // E2E tests
    "test:e2e:ui": "playwright test --ui",    // E2E with interactive UI
    "test:all": "npm run test && npm run test:e2e" // everything
  }
}
```
