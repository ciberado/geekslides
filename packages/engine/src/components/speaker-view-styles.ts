/**
 * GeekSlides v2 — SpeakerView CSS and layout constants.
 *
 * Extracted from SpeakerView.ts for maintainability.
 */

export const SUPPORTS_ZOOM = typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
  ? CSS.supports('zoom', '1')
  : false;

export const DEFAULT_NOTES_FONT_SIZE_REM = 1.15;
export const MIN_NOTES_FONT_SIZE_REM = 0.9;
export const MAX_NOTES_FONT_SIZE_REM = 1.75;
export const MIN_NOTES_WIDTH_PX = 300;
export const MIN_PREVIEW_HEIGHT_PX = 180;
export const SPLITTER_SIZE_PX = 14;
export const MOBILE_LAYOUT_BREAKPOINT_PX = 1100;

export const SPEAKER_PREVIEW_PARTIAL_STYLES = `
  .gs-partial {
    visibility: visible !important;
    opacity: 0.42 !important;
  }

  .gs-partial.gs-visible {
    opacity: 1 !important;
  }
`;

export const SPEAKER_STYLES = `
  :host {
    --gs-speaker-gap: 1rem;
    --gs-speaker-notes-font-size: ${String(DEFAULT_NOTES_FONT_SIZE_REM)}rem;
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: var(--gs-speaker-gap);
    width: 100vw;
    height: 100vh;
    padding: 1rem;
    box-sizing: border-box;
    background:
      radial-gradient(circle at top right, rgba(74, 158, 255, 0.18), transparent 28%),
      linear-gradient(180deg, #111827 0%, #0f172a 100%);
    color: #e5eefb;
    font-family: system-ui, sans-serif;
  }

  :host([data-resizing]) {
    user-select: none;
  }

  .main-layout {
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(22rem, 32rem) ${String(SPLITTER_SIZE_PX)}px minmax(0, 1fr);
    grid-template-areas: "notes notes-splitter previews";
    align-items: stretch;
  }

  .preview-stack {
    grid-area: previews;
    display: grid;
    grid-template-rows: minmax(0, 1fr) ${String(SPLITTER_SIZE_PX)}px minmax(0, 1fr);
    min-height: 0;
  }

  .preview-splitter {
    grid-row: 2;
  }

  .preview-card {
    min-height: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 0.75rem;
    padding: 0.85rem;
    border-radius: 12px;
    background: rgba(15, 23, 42, 0.72);
    border: 1px solid rgba(148, 163, 184, 0.2);
    box-shadow: 0 18px 36px rgba(0, 0, 0, 0.25);
  }

  .preview-label {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #94a3b8;
  }

  .current-card .preview-label {
    color: #7dd3fc;
  }

  .next-card .preview-label {
    color: #cbd5e1;
  }

  .viewport {
    position: relative;
    min-height: 0;
    overflow: hidden;
    border-radius: 10px;
    background:
      radial-gradient(circle at top center, rgba(125, 211, 252, 0.12), transparent 35%),
      #020617;
  }

  .stage {
    position: absolute;
    top: 0;
    left: 0;
    overflow: hidden;
    transform-origin: top left;
    pointer-events: none;
  }

  .viewport geek-slide {
    --gs-transition-duration: 0s;
    color: #000;
  }

  .viewport.empty {
    display: grid;
    place-items: center;
  }

  .empty-state {
    padding: 1.5rem;
    color: #64748b;
    font-size: 1rem;
    text-align: center;
  }

  .notes {
    grid-area: notes;
    min-width: 0;
    min-height: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 18px 36px rgba(0, 0, 0, 0.25);
  }

  .notes-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  }

  .notes-title {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #94a3b8;
  }

  .notes-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .notes-font-button {
    min-width: 2.5rem;
    padding: 0.35rem 0.7rem;
  }

  .notes-body {
    min-height: 0;
    overflow-y: auto;
    padding: 1.25rem 1.5rem 1.5rem;
    font-size: var(--gs-speaker-notes-font-size);
    line-height: 1.6;
  }

  .notes-body::-webkit-scrollbar {
    width: 8px;
  }

  .notes-body::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.45);
    border-radius: 4px;
  }

  .notes-body p { margin: 0.5em 0; }
  .notes-body ul, .notes-body ol { margin: 0.5em 0; padding-left: 1.5em; }
  .notes-body code { background: rgba(30, 41, 59, 0.9); padding: 0.15em 0.4em; border-radius: 3px; font-size: 0.9em; }
  .notes-body pre { background: rgba(30, 41, 59, 0.9); padding: 1em; border-radius: 4px; overflow-x: auto; }
  .notes-body a { color: #4a9eff; }

  .no-notes {
    color: #64748b;
    font-style: italic;
  }

  .splitter {
    position: relative;
    min-width: 0;
    min-height: 0;
    touch-action: none;
  }

  .splitter::before {
    content: '';
    position: absolute;
    inset: 2px;
    border-radius: 999px;
    background: rgba(148, 163, 184, 0.18);
    transition: background 0.15s ease;
  }

  .splitter:hover::before,
  .splitter:focus-visible::before {
    background: rgba(125, 211, 252, 0.34);
  }

  .main-splitter {
    grid-area: notes-splitter;
    cursor: col-resize;
  }

  .preview-splitter {
    cursor: row-resize;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 12px;
  }

  .timer {
    font-size: 2rem;
    font-variant-numeric: tabular-nums;
    font-family: monospace;
    min-width: 8ch;
  }

  .wall-clock {
    font-size: 1rem;
    font-variant-numeric: tabular-nums;
    font-family: monospace;
    color: #94a3b8;
    min-width: 5ch;
  }

  .counter {
    font-size: 1.1rem;
    color: #cbd5e1;
    margin-left: auto;
  }

  button {
    background: rgba(51, 65, 85, 0.9);
    color: #f8fafc;
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 999px;
    padding: 0.5rem 1rem;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  button:hover {
    background: rgba(71, 85, 105, 0.95);
    border-color: rgba(125, 211, 252, 0.45);
  }

  button:active { background: rgba(100, 116, 139, 0.95); }

  @media (max-width: ${String(MOBILE_LAYOUT_BREAKPOINT_PX)}px) {
    :host {
      grid-template-rows: minmax(0, 1fr) auto;
    }

    .main-layout {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
      grid-template-areas:
        "previews"
        "notes";
      gap: var(--gs-speaker-gap);
    }

    .main-splitter,
    .preview-splitter {
      display: none;
    }

    .preview-stack {
      grid-template-rows: minmax(0, 1.1fr) minmax(0, 0.9fr);
      gap: var(--gs-speaker-gap);
    }

    .notes {
      min-height: 18rem;
    }
  }

  @media (max-width: 720px) {
    :host {
      padding: 0.75rem;
    }

    .preview-stack {
      grid-template-rows: repeat(2, minmax(12rem, 1fr));
    }

    .controls {
      gap: 0.75rem;
    }

    .counter {
      margin-left: 0;
    }
  }
`;
