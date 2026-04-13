# Phase 12: E2E Tests & Polish

**Status**: Implemented (Playwright suite passing)
**Depends on**: All previous phases (tests span the full system)
**Unlocks**: Production release

## Goal

Write Playwright end-to-end tests covering all major user flows, set up CI pipeline,
align the sample presentation with the v2 runtime, and polish any remaining rough edges.

At the end of this phase, the v2 rewrite is complete, fully tested, and ready for
production use.

## Deliverables

### 1. Playwright E2E tests (`e2e/`)

All tests run across four Playwright projects: Desktop Chrome, Desktop Firefox,
Desktop Safari, and iPhone 14 (mobile).

**`e2e/navigation.spec.ts`**:
- Arrow keys navigate between slides.
- Home/End jump to first/last slide.
- Slide index updates are validated from component state.

**`e2e/commands.spec.ts`**:
- `t` opens terminal prompt.
- `help` prints available commands.
- `goto <n>` executes and updates slide position.
- Escape closes terminal.

**`e2e/sync.spec.ts`**:
- Two browser contexts in the same room stay synchronized.
- Presenter navigation updates follower tab.

**`e2e/whiteboard.spec.ts`**:
- `whiteboard` command toggles overlay.
- Canvas drawing events are validated.

**`e2e/mobile.spec.ts`** (iPhone 14 project):
- Swipe gestures navigate slides.
- Tap zones navigate previous/next.

**`e2e/speaker.spec.ts`**:
- `?view=speaker` opens speaker UI.
- Speaker tab reflects current and next slide info.

**`e2e/print.spec.ts`**:
- Print renderer outputs slides/slides-notes/book HTML variants.

### 2. CI pipeline (`.github/workflows/ci.yml`)

GitHub Actions workflow:

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

### 3. Sample presentation alignment

Use the active sample deck as the v2 baseline and archive the old v1 `demo/` directory.

### 4. Root README update

Rewrite the root `README.md` for v2:

### 5. Polish pass


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
decks/slides-cuatro-cosas-aws/ (active sample deck)
archived/v1/demo/             (legacy sample deck)
```

## Acceptance Criteria


## Reference Docs

