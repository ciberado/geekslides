# Phase 12: E2E Tests & Polish

**Status**: Not started
**Depends on**: All previous phases (tests span the full system)
**Unlocks**: Production release

## Goal

Write Playwright end-to-end tests covering all major user flows, set up CI pipeline,
migrate the demo presentation to v2 format, and polish any remaining rough edges.

At the end of this phase, the v2 rewrite is complete, fully tested, and ready for
production use.

## Deliverables

### 1. Playwright E2E tests (`e2e/`)

All tests run across four Playwright projects: Desktop Chrome, Desktop Firefox,
Desktop Safari, and iPhone 14 (mobile).

**`e2e/navigation.spec.ts`**:
- Arrow keys navigate between slides.
- Space advances, PageUp goes back.
- Home/End jump to first/last slide.
- Partials reveal before slide advances.
- Slide counter updates correctly.

**`e2e/commands.spec.ts`**:
- `Ctrl+B` shows prefix indicator, follow-up key executes command.
- Prefix mode auto-cancels after 1.5 s.
- `:` opens command palette, typing filters, Enter executes.
- Escape closes palette without action.

**`e2e/sync.spec.ts`**:
- Two browser contexts connected to the same room stay synced.
- Navigation in one context advances the other.
- Follow/unfollow toggle breaks and re-establishes sync.

**`e2e/whiteboard.spec.ts`**:
- Drawing produces visible strokes on the canvas.
- Strokes sync between two contexts.
- Clear removes all strokes.

**`e2e/mobile.spec.ts`** (iPhone 14 project):
- Swipe left/right navigates slides.
- Tap in right 2/3 advances, left 1/3 goes back.
- Toolbar is always visible.
- Long press opens toolbar actions.
- Audience auto-sync works.

**`e2e/speaker.spec.ts`**:
- Opening speaker view shows current slide thumbnail and notes.
- Navigation in presentation tab updates speaker view.
- Navigation from speaker view updates presentation tab.
- Timer starts and increments.

**`e2e/print.spec.ts`**:
- Browser print preview (`Ctrl+P`) renders one slide per page.
- No JavaScript errors in print preview.

### 2. CI pipeline (`.github/workflows/ci.yml`)

GitHub Actions workflow:

- **Trigger**: push to `main`, pull requests.
- **Matrix**: Node 22 on ubuntu-latest.
- **Steps**:
  1. Checkout.
  2. `npm ci`.
  3. `npm run typecheck` — TypeScript errors fail the build.
  4. `npm run lint` — ESLint errors fail the build.
  5. `npm test -- --coverage` — unit + integration tests with coverage.
  6. Upload coverage report as artifact.
  7. Install Playwright browsers.
  8. `npm run test:e2e` — Playwright tests.
  9. Upload Playwright report as artifact on failure.
  10. Coverage threshold check (80% branches/functions/lines).

### 3. Demo presentation migration

Migrate the v1 `demo/` directory to v2 format:
- Update `config.json` to v2 schema (add `plugins` field, update any deprecated keys).
- Verify `content.md` works with the v2 parser.
- Update `local.css` to use v2 CSS custom properties if needed.
- Ensure all features (charts, partials, backgrounds, speaker notes) render correctly.

### 4. Root README update

Rewrite the root `README.md` for v2:
- Quick start (install, dev, build).
- Authoring presentations (link to `vibe/` format docs).
- CLI commands reference.
- Docker deployment.
- Architecture overview (link to `vibe/features/`).

### 5. Polish pass

- Verify all CSS custom properties have sensible defaults.
- Test all components at common viewport sizes (1920×1080, 1366×768, 375×667).
- Verify `<style>` scoping doesn't leak across slides.
- Test with multiple presentation repos (demo + external like slides-cuatro-cosas-aws).
- Verify keyboard shortcuts don't conflict with browser defaults.
- Performance: profile slide loading for a 100-slide deck.

## File List

```
e2e/
├── playwright.config.ts      (updated)
├── navigation.spec.ts
├── commands.spec.ts
├── sync.spec.ts
├── whiteboard.spec.ts
├── mobile.spec.ts
├── speaker.spec.ts
└── print.spec.ts

.github/workflows/
└── ci.yml

README.md                     (rewritten)
demo/                         (migrated)
```

## Acceptance Criteria

- [ ] All Playwright E2E tests pass across Chrome, Firefox, Safari, and iPhone 14.
- [ ] CI pipeline runs on push and PR without manual intervention.
- [ ] Coverage exceeds 80% for branches, functions, and lines.
- [ ] Demo presentation renders identically to v1 (visual regression check).
- [ ] README provides clear instructions for new users.
- [ ] No console errors or warnings in a clean run.
- [ ] Performance: 100-slide deck loads in under 2 seconds on a mid-range machine.

## Reference Docs

- [testing.md](../testing.md) — Vitest + Playwright configuration, test pyramid
- [architecture-v2.md](../architecture-v2.md) — full system for integration points
- [components.md](../components.md) — mobile behavior for E2E mobile tests
