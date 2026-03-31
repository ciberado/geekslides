# Toolchain & Monorepo Structure

## Build Tool: Vite

### Why Vite over Parcel (v1)

| Aspect | Parcel (v1) | Vite (v2) |
|--------|-------------|-----------|
| Dev server startup | Bundles everything first | Native ESM, near-instant |
| HMR speed | Full page reload on many changes | Granular module replacement |
| Config | Zero-config (but limited control) | Minimal config with full escape hatches |
| TypeScript | Via plugin, slow type-stripping | Native esbuild transform (fast, no type-check) |
| CSS handling | Built-in but limited | PostCSS, CSS modules, preprocessors |
| Build output | Custom bundler | Rollup under the hood (proven, tree-shaking) |
| Ecosystem | Declining adoption | Dominant, active maintenance |

### Vite Configuration

```typescript
// vite.config.ts (root)
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'packages/engine',
  
  build: {
    lib: {
      entry: resolve(__dirname, 'packages/engine/src/index.ts'),
      name: 'GeekSlides',
      formats: ['es'],
    },
    rollupOptions: {
      // Externalize deps that shouldn't be bundled
      external: ['yjs', 'y-websocket', 'chart.js'],
    },
  },

  server: {
    // Dev server for presentation authoring
    proxy: {
      '/ws': {
        target: 'ws://localhost:1234',
        ws: true,
      },
    },
  },

  // Custom HMR handler for markdown reload
  plugins: [geekslidesHMR()],
});
```

### Custom HMR Plugin

```typescript
// vite-plugin-geekslides-hmr.ts
function geekslidesHMR(): Plugin {
  return {
    name: 'geekslides-hmr',
    handleHotUpdate({ file, server }) {
      if (file.endsWith('.md') || file.endsWith('.json')) {
        // Send custom event to client instead of full reload
        server.ws.send({
          type: 'custom',
          event: 'geekslides:content-update',
          data: { file },
        });
        return []; // prevent default HMR
      }
    },
  };
}

// Client-side HMR handler (in engine)
if (import.meta.hot) {
  import.meta.hot.on('geekslides:content-update', (data) => {
    document.dispatchEvent(new CustomEvent('geek:hmr:update', {
      detail: { file: data.file }
    }));
  });
}
```

## TypeScript Configuration

### Strict Mode

```jsonc
// tsconfig.json (root)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

### Per-package tsconfig

Each package extends the root:

```jsonc
// packages/engine/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": []  // engine has no internal deps
}
```

```jsonc
// packages/server/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2022"]  // no DOM
  },
  "include": ["src"]
}
```

## npm Workspaces

### Root package.json

```jsonc
{
  "name": "geekslides",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "npm run dev -w @geekslides/engine",
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces",
    "test:e2e": "playwright test",
    "lint": "eslint packages/*/src",
    "typecheck": "tsc --build"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vite": "^6.x",
    "vitest": "^3.x",
    "@playwright/test": "^1.x",
    "eslint": "^9.x"
  }
}
```

### Package Dependencies

```
@geekslides/engine (browser)
├── markdown-it          # markdown → HTML
├── yjs                  # CRDT shared types
├── y-websocket          # WebSocket provider (client)
└── chart.js             # table → chart rendering

@geekslides/server (Node.js)
├── yjs
├── y-websocket          # WebSocket server
└── ws                   # WebSocket implementation

@geekslides/cli (Node.js)
├── @geekslides/engine   # for build/render
├── vite                 # dev server API
├── sharp                # image optimization
└── commander            # CLI argument parsing
```

### Inter-package References

```
@geekslides/cli ──depends──> @geekslides/engine (for SSR/print rendering)
@geekslides/cli ──depends──> @geekslides/server (for dev command)
@geekslides/engine ──independent──
@geekslides/server ──independent──
```

## Development Workflow

### Local Development

```bash
# Install all workspace dependencies
npm install

# Start dev server (serves presentation from current dir)
npm run dev
# → Vite dev server on http://localhost:5173
# → yjs-server on ws://localhost:1234
# → HMR watches .md, .css, .json files

# Run all unit tests
npm test

# Run E2E tests
npm run test:e2e

# Type-check all packages
npm run typecheck

# Build production bundle
npm run build
```

### Package Development

```bash
# Work on engine only
npm run dev -w @geekslides/engine

# Test server only
npm test -w @geekslides/server

# Add dependency to a specific package
npm install chart.js -w @geekslides/engine
```

## Linting & Formatting

```jsonc
// eslint.config.js (flat config, ESLint 9)
import tseslint from 'typescript-eslint';

export default tseslint.config(
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      // Enforce explicit return types on public API
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      // No any
      '@typescript-eslint/no-explicit-any': 'error',
    },
  }
);
```
