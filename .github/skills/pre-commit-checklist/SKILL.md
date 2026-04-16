---
name: pre-commit-checklist
description: 'Pre-commit quality checklist. Use when: committing code, preparing to commit, staging changes, finishing a feature, about to git commit. Ensures tests pass, documentation is updated, how-to guides are current, and vibe docs reflect the changes before committing.'
---

# Pre-Commit Checklist

Run this checklist before every commit to ensure nothing is missed.

## When to Use

- Before any `git commit`
- When the user says "commit", "stage", "ready to commit", or similar
- After finishing a feature or bug fix

## Procedure

Work through each step in order. Skip steps that clearly don't apply (e.g. no how-to changes needed for a typo fix).

### 1. Run unit tests

```bash
npx vitest run
```

All tests must pass. If any fail, fix them before proceeding.

### 2. Run e2e tests

Only if changes touch runtime code (engine, server, CLI app, index.html):

```bash
npx playwright test --config=e2e/playwright.config.ts --reporter=line
```

The dev server must be running (`npm run dev`). Start it if needed. All tests must pass.

### 3. Check for new/updated unit tests

If you added or changed logic in `packages/engine/src/` or `packages/server/src/`, verify that corresponding test files exist or were updated in:

- `packages/engine/tests/unit/`
- `packages/server/tests/`

### 4. Check for new/updated e2e tests

If you added or changed user-facing behaviour (new features, new config options, new commands), verify that corresponding e2e test files exist or were updated in `e2e/`.

### 5. Update how-to guides

If the change affects user-facing features, check `how-to/` for guides that need updating:

- Does an existing guide cover this feature? Update it.
- Is this a new feature that deserves its own guide? Create one following the `how-to-guide` skill conventions.
- Update `how-to/README.md` index if a new guide was added.
- Fix navigation links (previous guide's `Next:` footer, new guide's footer).

### 6. Update vibe documentation

If the change affects architecture, APIs, testing, or decisions, check these files:

| File | Update when... |
|------|----------------|
| `vibe/features/plugin-system.md` | Plugin types, registration, loading, or proxy changes |
| `vibe/features/architecture-v2.md` | New files, directory structure changes, data flow changes |
| `vibe/features/testing.md` | New test files or significant test additions |
| `vibe/features/deployment-v2.md` | Server endpoints, Docker config, API surface changes |
| `vibe/features/decisions.md` | Architectural decisions added or changed |
| `vibe/features/sync.md` | Sync protocol or SyncManager changes |
| `vibe/features/content-proxy.md` | Content proxy API changes |
| `vibe/features/command-system.md` | New commands or command system changes |
| `vibe/features/speaker-notes.md` | Speaker view changes |
| `vibe/features/print.md` | PDF export or print template changes |
| `vibe/features/css-scaling.md` | Slide scaling or aspect ratio changes |
| `vibe/features/components.md` | Web component API changes |

### 7. Stage only relevant files

Use `git status --short` to review changes. Stage only files related to the current work. Do not stage unrelated changes (e.g. submodule pointer drifts).

### 8. Write a conventional commit message

Format: `<type>: <subject>`

Types:
- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `test:` — test additions or fixes
- `refactor:` — code restructuring without behaviour change
- `chore:` — build, tooling, dependency updates

For multi-line bodies, summarize what changed and list key items with `-` bullets.

### 9. Commit

Run the commit. Confirm it succeeds.

## Quick Reference: What to Check by Change Type

| Changed | Tests | E2E | How-to | Vibe docs |
|---------|-------|-----|--------|-----------|
| Engine logic (`packages/engine/src/`) | ✓ | Maybe | If user-facing | `architecture-v2.md`, relevant feature doc |
| Server (`packages/server/src/`) | ✓ | Maybe | If user-facing | `deployment-v2.md`, relevant feature doc |
| CLI app (`packages/cli/`, `index.html`) | ✓ | ✓ | If user-facing | `architecture-v2.md` |
| Config schema (`Config.ts`) | ✓ | ✓ | ✓ | `architecture-v2.md` |
| New web component | ✓ | ✓ | ✓ | `components.md`, `architecture-v2.md` |
| Documentation only | — | — | ✓ | Maybe |
| Test only | ✓ | — | — | `testing.md` |
