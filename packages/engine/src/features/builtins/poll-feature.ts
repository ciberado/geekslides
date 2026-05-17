/**
 * GeekSlides v2 — Poll Feature.
 *
 * Turns any slide with the `.poll` CSS class and a markdown list into a live
 * audience poll.
 *
 * **Presenter** sees a side-panel with:
 *   - A QR code linking voters to /vote.html
 *   - Live vote counts per option (updated in real-time via Yjs)
 *   - A "Freeze & Show Results" button that replaces the QR with a bar chart
 *
 * **Viewers** (readonly sessions) see clickable option buttons directly in the
 * overlay.  Votes are submitted via the generic `POST /api/feature-write`
 * endpoint (bypasses the Yjs readonly-filter).  The server writes the vote
 * into the shared Y.Map; all clients receive the update via normal Yjs sync.
 *
 * Deck setup — add to config.json:
 *   { "features": ["poll"] }
 *
 * Slide setup:
 *   [](#my-poll.poll)
 *   ## Who is your favourite?
 *   - Option A
 *   - Option B
 *   - Option C
 */

import type { Feature, FeatureContext } from '../types.ts';
import { Chart, BarController, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import { createLogger } from '../../logging.ts';

Chart.register(BarController, CategoryScale, LinearScale, BarElement, Tooltip);

const log = createLogger('poll');

/* ------------------------------------------------------------------ */
/*  Yjs key helpers — all poll data lives in one shared Y.Map         */
/* ------------------------------------------------------------------ */

function keyOptions(i: number): string { return `slide-${String(i)}-options`; }
function keyFrozen(i: number): string  { return `slide-${String(i)}-frozen`; }
function keyActive(i: number): string  { return `slide-${String(i)}-active`; }
function votePrefix(i: number): string { return `slide-${String(i)}-vote-`; }
function keyVote(i: number, voterId: string): string { return `${votePrefix(i)}${voterId}`; }

/* ------------------------------------------------------------------ */
/*  Voter identity (shared between presenter view and voter page)     */
/* ------------------------------------------------------------------ */

const VOTER_ID_KEY = 'geekslides-voter-id';

/** Generate a UUID v4, with a fallback for non-secure (HTTP) contexts. */
function generateUUID(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function getVoterId(): string {
  let id = localStorage.getItem(VOTER_ID_KEY);
  if (!id) {
    id = generateUUID();
    localStorage.setItem(VOTER_ID_KEY, id);
  }
  return id;
}

function localVoteKey(room: string, slideIndex: number): string {
  return `geekslides-voted-${room}-${String(slideIndex)}`;
}

/* ------------------------------------------------------------------ */
/*  Utility: lazy load QRCode                                          */
/* ------------------------------------------------------------------ */

let qrcodeReady: Promise<typeof import('qrcode')> | null = null;

async function getQRCode(): Promise<typeof import('qrcode')> {
  if (!qrcodeReady) {
    qrcodeReady = import('qrcode');
  }
  return qrcodeReady;
}

/* ------------------------------------------------------------------ */
/*  Utility: scan slides for poll options                              */
/* ------------------------------------------------------------------ */

export interface PollSlideConfig {
  /** Voting options extracted from the slide's list items. */
  options: string[];
  /**
   * When `true` (slide has `.poll-live` class), vote percentages are shown
   * in real-time as votes arrive.  When `false` (default), percentages and
   * bars are hidden until the presenter freezes the poll.
   */
  live: boolean;
}

export function getPollSlides(container: HTMLElement): Map<number, PollSlideConfig> {
  const result = new Map<number, PollSlideConfig>();
  const gsContainer = container.parentElement?.parentElement;
  if (!gsContainer) return result;

  const slideEls = gsContainer.querySelectorAll('geek-slide');
  slideEls.forEach((el, i) => {
    const shadowRoot = el.shadowRoot;
    if (!shadowRoot) return;
    const content = shadowRoot.querySelector<HTMLElement>('section.content');
    if (!content?.classList.contains('poll')) return;

    const items = content.querySelectorAll('li');
    if (items.length < 2) return;

    const options = Array.from(items).map((li) => li.textContent.trim());
    const live = content.classList.contains('poll-live');
    result.set(i, { options, live });
  });

  return result;
}

/* ------------------------------------------------------------------ */
/*  Utility: count votes from Yjs shared map                          */
/* ------------------------------------------------------------------ */

export function countVotes(
  map: import('yjs').Map<unknown>,
  slideIndex: number,
  optionCount: number,
): number[] {
  const counts = new Array<number>(optionCount).fill(0);
  const prefix = votePrefix(slideIndex);
  map.forEach((value, key) => {
    if (!key.startsWith(prefix)) return;
    const idx = typeof value === 'number' ? value : -1;
    if (idx >= 0 && idx < optionCount) {
      counts[idx] = (counts[idx] ?? 0) + 1;
    }
  });
  return counts;
}

/* ------------------------------------------------------------------ */
/*  Poll panel builder                                                 */
/* ------------------------------------------------------------------ */

const PANEL_CSS = `
  .gs-poll-panel {
    position: absolute;
    right: 20px;
    bottom: 20px;
    width: 480px;
    background: rgba(15, 15, 25, 0.92);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 16px;
    color: #fff;
    font-family: system-ui, sans-serif;
    font-size: 22px;
    box-shadow: 0 8px 48px rgba(0,0,0,0.6);
    overflow: hidden;
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    gap: 0;
    z-index: 200;
    transition: width 0.35s ease;
  }
  /* Frozen: expand to a centered modal */
  .gs-poll-panel.frozen {
    right: auto;
    bottom: auto;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(92%, 780px);
    z-index: 250;
  }
  .gs-poll-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 18px 22px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .gs-poll-icon { font-size: 26px; }
  .gs-poll-title { font-weight: 700; flex: 1; font-size: 22px; }
  .gs-poll-count {
    background: rgba(99,179,237,0.2);
    color: #63b3ed;
    border-radius: 20px;
    padding: 4px 14px;
    font-size: 18px;
    font-weight: 600;
  }
  .gs-poll-body {
    display: flex;
    gap: 16px;
    padding: 18px 22px;
    min-height: 170px;
  }
  .gs-poll-body.frozen-layout {
    flex-direction: column;
    min-height: 0;
    padding-top: 12px;
  }
  .gs-poll-qr {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .gs-poll-qr img {
    width: 180px;
    height: 180px;
    border-radius: 8px;
    background: #fff;
    padding: 6px;
    box-sizing: border-box;
  }
  .gs-poll-qr-label {
    font-size: 15px;
    color: rgba(255,255,255,0.55);
    text-align: center;
  }
  .gs-poll-options {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 10px;
    min-width: 0;
  }
  .gs-poll-option { display: flex; flex-direction: column; gap: 4px; }
  .gs-poll-option-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .gs-poll-option-label {
    font-size: 18px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }
  .gs-poll-option-pct {
    font-size: 18px;
    font-weight: 700;
    color: #63b3ed;
    min-width: 52px;
    text-align: right;
  }
  .gs-poll-option-pct.hidden-pct { color: rgba(255,255,255,0.25); }
  .gs-poll-bar-wrap {
    height: 10px;
    background: rgba(255,255,255,0.1);
    border-radius: 5px;
    overflow: hidden;
  }
  .gs-poll-bar {
    height: 100%;
    background: linear-gradient(90deg, #63b3ed, #4299e1);
    border-radius: 5px;
    transition: width 0.4s ease;
  }
  /* Chart container — height set via inline style based on option count */
  .gs-poll-chart-wrap {
    display: none;
    width: 100%;
  }
  .gs-poll-chart-wrap.visible { display: block; }
  .gs-poll-footer {
    padding: 14px 22px 18px;
    border-top: 1px solid rgba(255,255,255,0.08);
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
  .gs-poll-btn {
    background: linear-gradient(135deg, #4299e1, #3182ce);
    border: none;
    color: #fff;
    border-radius: 10px;
    padding: 10px 22px;
    font-size: 19px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  .gs-poll-btn:hover { opacity: 0.85; }
  .gs-poll-btn:disabled {
    background: rgba(255,255,255,0.15);
    cursor: default;
    opacity: 0.6;
  }
  .gs-poll-frozen-badge {
    font-size: 17px;
    color: rgba(255,255,255,0.45);
    display: none;
    align-items: center;
    gap: 6px;
  }
  .gs-poll-frozen-badge.visible { display: flex; }

  /* Viewer mode — clickable option buttons */
  .gs-poll-viewer-body {
    display: flex;
    flex-direction: column;
    padding: 18px 22px;
    gap: 12px;
  }
  .gs-poll-viewer-option {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .gs-poll-voter-btn {
    background: rgba(255,255,255,0.08);
    border: 1.5px solid rgba(255,255,255,0.18);
    color: #fff;
    border-radius: 10px;
    padding: 10px 18px;
    font-size: 19px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s, border-color 0.15s;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .gs-poll-voter-btn:hover:not(:disabled) {
    background: rgba(99,179,237,0.18);
    border-color: #63b3ed;
  }
  .gs-poll-voter-btn.selected {
    background: rgba(99,179,237,0.28);
    border-color: #63b3ed;
    font-weight: 700;
  }
  .gs-poll-voter-btn:disabled { cursor: default; }
  .gs-poll-voter-btn-pct {
    font-size: 16px;
    font-weight: 700;
    color: #63b3ed;
    min-width: 44px;
    text-align: right;
  }
  .gs-poll-viewer-bar-wrap {
    height: 6px;
    background: rgba(255,255,255,0.08);
    border-radius: 3px;
    overflow: hidden;
  }
  .gs-poll-viewer-bar {
    height: 100%;
    background: linear-gradient(90deg, #63b3ed, #4299e1);
    border-radius: 3px;
    transition: width 0.4s ease;
  }
  .gs-poll-frozen-viewer {
    padding: 6px 22px 14px;
    font-size: 16px;
    color: rgba(255,255,255,0.45);
    display: none;
    align-items: center;
    gap: 6px;
  }
  .gs-poll-frozen-viewer.visible { display: flex; }

  /* QR expand + copy buttons */
  .gs-poll-qr-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: center;
  }
  .gs-poll-qr-icon-btn {
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.5);
    font-size: 14px;
    cursor: pointer;
    padding: 2px 5px;
    border-radius: 4px;
    line-height: 1.2;
    transition: color 0.15s;
  }
  .gs-poll-qr-icon-btn:hover { color: rgba(255,255,255,0.9); }
  /* Full-slide QR overlay */
  .gs-poll-overlay {
    display: none;
    position: absolute;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.87);
    z-index: 500;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 14px;
    cursor: pointer;
    pointer-events: auto;
  }
  .gs-poll-overlay.visible { display: flex; }
  .gs-poll-overlay-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    cursor: default;
    position: relative;
  }
  .gs-poll-overlay img {
    width: min(70vw, 70vh);
    height: min(70vw, 70vh);
    border-radius: 16px;
    background: #fff;
    padding: 16px;
    box-sizing: border-box;
    box-shadow: 0 0 0 8px #fff, 0 12px 60px rgba(0,0,0,0.8);
  }
  .gs-poll-overlay-url {
    font-size: 16px;
    color: #63b3ed;
    text-align: center;
    word-break: break-all;
    max-width: min(70vw, 600px);
    text-decoration: none;
  }
  .gs-poll-overlay-url:hover { text-decoration: underline; }
  .gs-poll-overlay-close {
    position: absolute;
    top: -16px;
    right: -16px;
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.25);
    color: #fff;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    transition: background 0.15s;
    pointer-events: auto;
  }
  .gs-poll-overlay-close:hover { background: rgba(255,255,255,0.25); }
`;



/* ---- Presenter panel ---- */

interface PollPanel {
  readonly el: HTMLElement;
  update(counts: number[], frozen: boolean): void;
  destroy(): void;
}

function buildPresenterPanel(
  options: string[],
  voteUrl: string,
  outerContainer: HTMLElement,
  onFreeze: () => void,
  live: boolean,
): PollPanel {
  const el = document.createElement('div');
  el.className = 'gs-poll-panel';

  el.innerHTML = `
    <div class="gs-poll-header">
      <span class="gs-poll-icon">📊</span>
      <span class="gs-poll-title">Live Poll${live ? ' 🔴' : ''}</span>
      <span class="gs-poll-count">0 votes</span>
    </div>
    <div class="gs-poll-body">
      <div class="gs-poll-qr">
        <img class="gs-poll-qr-img" alt="QR code" />
        <div class="gs-poll-qr-actions">
          <span class="gs-poll-qr-label">Scan to vote</span>
          <button class="gs-poll-qr-icon-btn gs-poll-qr-expand-btn" title="Show large QR">🔍</button>
          <button class="gs-poll-qr-icon-btn gs-poll-qr-copy-btn" title="Copy vote link">🔗</button>
        </div>
      </div>
      <div class="gs-poll-options"></div>
      <div class="gs-poll-chart-wrap"></div>
    </div>
    <div class="gs-poll-footer">
      <span class="gs-poll-frozen-badge">🔒 Results shown</span>
      <button class="gs-poll-btn gs-poll-freeze-btn">Freeze &amp; Show Results</button>
    </div>
  `;

  const countEl = el.querySelector<HTMLElement>('.gs-poll-count');
  const qrImg = el.querySelector<HTMLImageElement>('.gs-poll-qr-img');
  const qrWrap = el.querySelector<HTMLElement>('.gs-poll-qr');
  const bodyEl = el.querySelector<HTMLElement>('.gs-poll-body');
  const optionsEl = el.querySelector<HTMLElement>('.gs-poll-options');
  const chartWrap = el.querySelector<HTMLElement>('.gs-poll-chart-wrap');
  const frozenBadge = el.querySelector<HTMLElement>('.gs-poll-frozen-badge');
  const freezeBtn = el.querySelector<HTMLButtonElement>('.gs-poll-freeze-btn');

  freezeBtn?.addEventListener('click', onFreeze);

  /* ---- Fullscreen QR overlay ---- */
  const overlay = document.createElement('div');
  overlay.className = 'gs-poll-overlay';
  const overlayInner = document.createElement('div');
  overlayInner.className = 'gs-poll-overlay-inner';
  const overlayCloseBtn = document.createElement('button');
  overlayCloseBtn.className = 'gs-poll-overlay-close';
  overlayCloseBtn.title = 'Close';
  overlayCloseBtn.textContent = '✕';
  const overlayQrImg = document.createElement('img');
  overlayQrImg.alt = 'QR code';
  const overlayUrl = document.createElement('a');
  overlayUrl.className = 'gs-poll-overlay-url';
  overlayUrl.textContent = voteUrl;
  overlayUrl.href = voteUrl;
  overlayUrl.target = '_blank';
  overlayUrl.rel = 'noopener noreferrer';
  overlayInner.appendChild(overlayCloseBtn);
  overlayInner.appendChild(overlayQrImg);
  overlayInner.appendChild(overlayUrl);
  overlay.appendChild(overlayInner);
  outerContainer.appendChild(overlay);

  function showOverlay(): void { overlay.classList.add('visible'); }
  function hideOverlay(): void { overlay.classList.remove('visible'); }

  overlay.addEventListener('click', hideOverlay);
  overlayInner.addEventListener('click', (e) => { e.stopPropagation(); });
  overlayCloseBtn.addEventListener('click', (e) => { e.stopPropagation(); hideOverlay(); });
  overlayUrl.addEventListener('click', (e) => { e.stopPropagation(); });

  const onEscape = (e: KeyboardEvent): void => { if (e.key === 'Escape') hideOverlay(); };
  document.addEventListener('keydown', onEscape);

  /* ---- Clipboard helper (navigator.clipboard with textarea fallback) ---- */
  function copyText(text: string, btn: HTMLButtonElement): void {
    const flash = (): void => {
      const orig = btn.textContent;
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    };
    const fallback = (): void => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { document.execCommand('copy'); flash(); } catch { /* give up */ }
      ta.remove();
    };
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).then(flash).catch(fallback);
    } else {
      fallback();
    }
  }

  /* ---- Expand button ---- */
  const expandBtn = el.querySelector<HTMLButtonElement>('.gs-poll-qr-expand-btn');
  expandBtn?.addEventListener('click', showOverlay);

  /* ---- Copy-link button ---- */
  const copyBtn = el.querySelector<HTMLButtonElement>('.gs-poll-qr-copy-btn');
  copyBtn?.addEventListener('click', () => { if (copyBtn) copyText(voteUrl, copyBtn); });

  const optionEls: { bar: HTMLElement; pct: HTMLElement }[] = [];
  options.forEach((label) => {
    const row = document.createElement('div');
    row.className = 'gs-poll-option';
    row.innerHTML = `
      <div class="gs-poll-option-row">
        <span class="gs-poll-option-label">${label}</span>
        <span class="gs-poll-option-pct${live ? '' : ' hidden-pct'}">—</span>
      </div>
      <div class="gs-poll-bar-wrap">
        <div class="gs-poll-bar" style="width:0%"></div>
      </div>
    `;
    optionsEl?.appendChild(row);
    const bar = row.querySelector<HTMLElement>('.gs-poll-bar');
    const pct = row.querySelector<HTMLElement>('.gs-poll-option-pct');
    if (bar && pct) optionEls.push({ bar, pct });
  });

  void getQRCode().then((QRCode) =>
    QRCode.toDataURL(voteUrl, { width: 600, margin: 1, color: { dark: '#000000', light: '#ffffff' } }),
  ).then((dataUrl) => {
    if (qrImg) qrImg.src = dataUrl;
    overlayQrImg.src = dataUrl;
  }).catch((err: unknown) => {
    log.warn({ err }, 'QR code generation failed');
  });

  let chart: Chart | null = null;

  function update(counts: number[], frozen: boolean): void {
    const total = counts.reduce((a, b) => a + b, 0);
    if (countEl) countEl.textContent = `${String(total)} vote${total === 1 ? '' : 's'}`;

    // Show bars/percentages live, or hide them until freeze (end-only mode).
    const showBars = live || frozen;
    counts.forEach((c, i) => {
      const entry = optionEls[i];
      if (!entry) return;
      const pctVal = total > 0 ? Math.round((c / total) * 100) : 0;
      entry.bar.style.width = showBars ? `${String(pctVal)}%` : '0%';
      entry.pct.textContent = showBars ? `${String(pctVal)}%` : '—';
      entry.pct.classList.toggle('hidden-pct', !showBars);
    });

    if (frozen) {
      el.classList.add('frozen');
      if (bodyEl) bodyEl.classList.add('frozen-layout');
      if (qrWrap) qrWrap.style.display = 'none';
      if (optionsEl) optionsEl.style.display = 'none';
      if (chartWrap) chartWrap.classList.add('visible');
      if (frozenBadge) frozenBadge.classList.add('visible');
      if (freezeBtn) { freezeBtn.disabled = true; freezeBtn.style.display = 'none'; }

      if (!chart && chartWrap) {
        const canvas = document.createElement('canvas');
        chartWrap.style.height = `${String(Math.max(160, options.length * 56))}px`;
        chartWrap.appendChild(canvas);
        chart = new Chart(canvas, {
          type: 'bar',
          data: {
            labels: options,
            datasets: [{
              data: counts,
              backgroundColor: 'rgba(99,179,237,0.8)',
              borderColor: '#63b3ed',
              borderWidth: 1,
              borderRadius: 4,
            }],
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: true } },
            scales: {
              x: {
                ticks: { color: '#fff', font: { size: 16 } },
                grid: { color: 'rgba(255,255,255,0.1)' },
              },
              y: {
                ticks: { color: '#fff', font: { size: 17 } },
                grid: { display: false },
              },
            },
          },
        });
      } else if (chart) {
        const ds = chart.data.datasets[0];
        if (ds) ds.data = counts;
        chart.update();
      }
    } else {
      el.classList.remove('frozen');
      if (bodyEl) bodyEl.classList.remove('frozen-layout');
      if (qrWrap) qrWrap.style.display = '';
      if (optionsEl) optionsEl.style.display = '';
      if (chartWrap) chartWrap.classList.remove('visible');
      if (frozenBadge) frozenBadge.classList.remove('visible');
      if (freezeBtn) { freezeBtn.disabled = false; }
    }
  }

  function destroy(): void {
    chart?.destroy();
    chart = null;
    overlay.remove();
    document.removeEventListener('keydown', onEscape);
  }

  return { el, update, destroy };
}

/* ---- Viewer panel (clickable options + HTTP vote) ---- */

function buildViewerPanel(
  options: string[],
  room: string,
  slideIndex: number,
  isFrozen: () => boolean,
  live: boolean,
): PollPanel {
  const el = document.createElement('div');
  el.className = 'gs-poll-panel';

  el.innerHTML = `
    <div class="gs-poll-header">
      <span class="gs-poll-icon">📊</span>
      <span class="gs-poll-title">Live Poll</span>
      <span class="gs-poll-count">0 votes</span>
    </div>
    <div class="gs-poll-viewer-body"></div>
    <span class="gs-poll-frozen-viewer">🔒 Poll is frozen</span>
  `;

  const countEl = el.querySelector<HTMLElement>('.gs-poll-count');
  const bodyEl = el.querySelector<HTMLElement>('.gs-poll-viewer-body');
  const frozenEl = el.querySelector<HTMLElement>('.gs-poll-frozen-viewer');

  // Restore prior vote if any
  const savedVote = localStorage.getItem(localVoteKey(room, slideIndex));
  let votedIndex: number | null = savedVote !== null ? Number(savedVote) : null;
  const hasVoted = votedIndex !== null;

  const voterId = getVoterId();

  const btns: HTMLButtonElement[] = [];
  const pctEls: HTMLElement[] = [];
  const bars: HTMLElement[] = [];

  options.forEach((label, i) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'gs-poll-viewer-option';

    const btn = document.createElement('button');
    btn.className = 'gs-poll-voter-btn';
    if (hasVoted && votedIndex === i) btn.classList.add('selected');
    btn.disabled = hasVoted;
    btn.innerHTML = `<span>${label}</span><span class="gs-poll-voter-btn-pct">0%</span>`;

    const barWrap = document.createElement('div');
    barWrap.className = 'gs-poll-viewer-bar-wrap';
    const bar = document.createElement('div');
    bar.className = 'gs-poll-viewer-bar';
    bar.style.width = '0%';
    barWrap.appendChild(bar);

    wrapper.appendChild(btn);
    wrapper.appendChild(barWrap);
    bodyEl?.appendChild(wrapper);

    btns.push(btn);
    bars.push(bar);
    const pctEl = btn.querySelector<HTMLElement>('.gs-poll-voter-btn-pct');
    if (pctEl) pctEls.push(pctEl);

    btn.addEventListener('click', () => {
      if (votedIndex !== null || isFrozen()) return;
      votedIndex = i;
      localStorage.setItem(localVoteKey(room, slideIndex), String(i));

      btns.forEach((b, j) => {
        b.disabled = true;
        if (j === i) b.classList.add('selected');
      });

      fetch('/api/feature-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room,
          featureId: 'poll',
          updates: { [keyVote(slideIndex, voterId)]: i },
        }),
      }).catch((err: unknown) => {
        log.warn({ err }, 'viewer poll vote POST failed');
      });
    });
  });

  function update(counts: number[], frozen: boolean): void {
    const total = counts.reduce((a, b) => a + b, 0);
    if (countEl) countEl.textContent = `${String(total)} vote${total === 1 ? '' : 's'}`;

    const showBars = live || frozen;
    counts.forEach((c, i) => {
      const pctVal = total > 0 ? Math.round((c / total) * 100) : 0;
      const pctEl = pctEls[i];
      const bar = bars[i];
      if (pctEl) pctEl.textContent = showBars ? `${String(pctVal)}%` : '—';
      if (bar) bar.style.width = showBars ? `${String(pctVal)}%` : '0%';
    });

    if (frozen) {
      btns.forEach((b) => { b.disabled = true; });
      if (frozenEl) frozenEl.classList.add('visible');
    } else {
      // Re-enable only if not voted
      if (votedIndex === null) {
        btns.forEach((b) => { b.disabled = false; });
      }
      if (frozenEl) frozenEl.classList.remove('visible');
    }
  }

  return { el, update, destroy: () => { /* no chart to destroy */ } };
}

/* ------------------------------------------------------------------ */
/*  Feature definition                                                 */
/* ------------------------------------------------------------------ */

export const pollFeature: Feature = {
  id: 'poll',
  label: 'Live audience poll with QR voting',

  activate(ctx: FeatureContext): () => void {
    // `syncMap` may become stale after Yjs CRDT resolution: the server's
    // existing Y.Map for 'poll' can win the merge, making `syncMap` point to
    // the losing (no-longer-active) map.  We therefore:
    //  1. Keep `syncMap` only for the initial write (creating the map if absent).
    //  2. Use `featuresRoot.observeDeep` so ANY change inside 'features' fires
    //     our callback, regardless of which Y.Map won the CRDT conflict.
    //  3. Always read from `featuresRoot.get('poll')` dynamically inside callbacks.
    const syncMap = ctx.sync?.getSharedMap() ?? null;
    const isPresenter = ctx.role === 'presenter';
    const isViewer = ctx.role === 'viewer';

    // Raw doc/root for dynamic poll-map access after CRDT resolution.
    // Fall back to syncMap.doc so unit tests (where syncManager is null) work too.
    const doc = ctx.syncManager?.doc ?? syncMap?.doc ?? null;
    const featuresRoot = doc?.getMap('features') ?? null;

    function getPollMap(): import('yjs').Map<unknown> | null {
      return (featuresRoot?.get('poll') as import('yjs').Map<unknown> | undefined) ?? null;
    }

    const styleEl = document.createElement('style');
    styleEl.textContent = PANEL_CSS;
    ctx.container.appendChild(styleEl);

    ctx.container.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';

    const pollSlides = getPollSlides(ctx.container);
    if (pollSlides.size === 0) {
      log.info({}, 'no .poll slides found — feature inactive');
      return () => { styleEl.remove(); };
    }

    const room = new URLSearchParams(location.search).get('room')
      ?? ctx.config.sync.room;

    // Write poll options to whichever Y.Map is currently active.
    // Called once on activation and again if the poll-map reference changes
    // after Yjs sync resolves the CRDT conflict.
    function writeOptions(): void {
      const pollMap = getPollMap();
      if (!pollMap) return;
      pollSlides.forEach(({ options }, slideIndex) => {
        pollMap.set(keyOptions(slideIndex), JSON.stringify(options));
      });
    }

    if (syncMap && isPresenter) {
      ctx.syncManager?.doc.transact(() => { writeOptions(); });
    }

    let currentPanel: PollPanel | null = null;
    let currentSlideIndex = -1;

    function showPollForSlide(slideIndex: number): void {
      if (currentPanel) {
        currentPanel.destroy();
        currentPanel.el.remove();
        currentPanel = null;
      }

      const slideConfig = pollSlides.get(slideIndex);
      if (!slideConfig) {
        currentSlideIndex = -1;
        return;
      }

      const { options, live } = slideConfig;
      currentSlideIndex = slideIndex;

      let panel: PollPanel;

      if (isViewer) {
        panel = buildViewerPanel(options, room, slideIndex, () =>
          getPollMap()?.get(keyFrozen(slideIndex)) === true,
        live);
      } else {
        const vtoken = new URLSearchParams(location.search).get('vtoken');
        const vtokenPart = vtoken ? `&vtoken=${encodeURIComponent(vtoken)}` : '';
        const voteUrl = `${location.origin}/vote.html?room=${encodeURIComponent(room)}&slide=${String(slideIndex)}${vtokenPart}`;
        panel = buildPresenterPanel(options, voteUrl, ctx.container, () => {
          if (!isPresenter) return;
          const pollMap = getPollMap();
          if (!pollMap) return;
          pollMap.set(keyFrozen(slideIndex), true);
        }, live);
      }

      ctx.container.appendChild(panel.el);
      currentPanel = panel;

      // Mark active in Yjs (presenter only)
      if (isPresenter) {
        const pollMap = getPollMap();
        if (pollMap) pollMap.set(keyActive(slideIndex), true);
      }

      // Initial render
      const pollMap = getPollMap();
      const counts = pollMap
        ? countVotes(pollMap, slideIndex, options.length)
        : new Array<number>(options.length).fill(0);
      const frozen = pollMap ? (pollMap.get(keyFrozen(slideIndex)) === true) : false;
      panel.update(counts, frozen);
    }

    function hidePoll(): void {
      if (currentPanel) {
        currentPanel.destroy();
        currentPanel.el.remove();
        currentPanel = null;
      }
      currentSlideIndex = -1;
    }

    // Deep observer: fires for any change inside doc.getMap('features'),
    // including votes/frozen in the poll Y.Map — no matter which Y.Map
    // won the CRDT conflict after Yjs sync.
    const cleanups: Array<() => void> = [];

    if (featuresRoot) {
      const deepObserver = (): void => {
        if (currentSlideIndex < 0 || !currentPanel) return;
        const pollMap = getPollMap();
        if (!pollMap) return;
        const slideConfig = pollSlides.get(currentSlideIndex);
        if (!slideConfig) return;
        const counts = countVotes(pollMap, currentSlideIndex, slideConfig.options.length);
        const frozen = pollMap.get(keyFrozen(currentSlideIndex)) === true;
        currentPanel.update(counts, frozen);
      };
      featuresRoot.observeDeep(deepObserver);
      cleanups.push(() => { featuresRoot.unobserveDeep(deepObserver); });

      // Shallow observer: re-write options whenever the 'poll' map reference
      // itself changes (i.e., CRDT resolution picked a different Y.Map).
      if (isPresenter) {
        const rootObserver = (event: import('yjs').YMapEvent<unknown>): void => {
          if (!event.keysChanged.has('poll')) return;
          ctx.syncManager?.doc.transact(() => { writeOptions(); });
        };
        featuresRoot.observe(rootObserver);
        cleanups.push(() => { featuresRoot.unobserve(rootObserver); });
      }
    } else if (syncMap) {
      // No raw doc available — fall back to observing the initial syncMap
      const observer = (): void => {
        if (currentSlideIndex < 0 || !currentPanel) return;
        const slideConfig = pollSlides.get(currentSlideIndex);
        if (!slideConfig) return;
        const counts = countVotes(syncMap, currentSlideIndex, slideConfig.options.length);
        const frozen = syncMap.get(keyFrozen(currentSlideIndex)) === true;
        currentPanel.update(counts, frozen);
      };
      syncMap.observe(observer);
      cleanups.push(() => { syncMap.unobserve(observer); });
    }

    const unsubEnter = ctx.on('slide:enter', ({ slideIndex }) => {
      showPollForSlide(slideIndex);
    });

    const unsubLeave = ctx.on('slide:leave', () => {
      hidePoll();
    });

    showPollForSlide(ctx.slideshow.currentSlide);

    return () => {
      unsubEnter();
      unsubLeave();
      cleanups.forEach((fn) => { fn(); });
      hidePoll();
      styleEl.remove();
    };
  },
};

