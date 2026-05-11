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

function getVoterId(): string {
  let id = localStorage.getItem(VOTER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
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

export function getPollSlides(container: HTMLElement): Map<number, string[]> {
  const result = new Map<number, string[]>();
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
    result.set(i, options);
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
  .gs-poll-qr {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .gs-poll-qr img {
    width: 140px;
    height: 140px;
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
    max-width: 200px;
  }
  .gs-poll-option-pct {
    font-size: 18px;
    font-weight: 700;
    color: #63b3ed;
    min-width: 52px;
    text-align: right;
  }
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
  .gs-poll-chart-wrap {
    flex: 1;
    min-height: 150px;
    display: none;
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
  onFreeze: () => void,
): PollPanel {
  const el = document.createElement('div');
  el.className = 'gs-poll-panel';

  el.innerHTML = `
    <div class="gs-poll-header">
      <span class="gs-poll-icon">📊</span>
      <span class="gs-poll-title">Live Poll</span>
      <span class="gs-poll-count">0 votes</span>
    </div>
    <div class="gs-poll-body">
      <div class="gs-poll-qr">
        <img class="gs-poll-qr-img" alt="QR code" />
        <span class="gs-poll-qr-label">Scan to vote</span>
      </div>
      <div class="gs-poll-options"></div>
      <canvas class="gs-poll-chart-wrap"></canvas>
    </div>
    <div class="gs-poll-footer">
      <span class="gs-poll-frozen-badge">🔒 Results shown</span>
      <button class="gs-poll-btn gs-poll-freeze-btn">Freeze &amp; Show Results</button>
    </div>
  `;

  const countEl = el.querySelector<HTMLElement>('.gs-poll-count');
  const qrImg = el.querySelector<HTMLImageElement>('.gs-poll-qr-img');
  const qrWrap = el.querySelector<HTMLElement>('.gs-poll-qr');
  const optionsEl = el.querySelector<HTMLElement>('.gs-poll-options');
  const chartCanvas = el.querySelector<HTMLCanvasElement>('.gs-poll-chart-wrap');
  const frozenBadge = el.querySelector<HTMLElement>('.gs-poll-frozen-badge');
  const freezeBtn = el.querySelector<HTMLButtonElement>('.gs-poll-freeze-btn');

  freezeBtn?.addEventListener('click', onFreeze);

  const optionEls: { bar: HTMLElement; pct: HTMLElement }[] = [];
  options.forEach((label) => {
    const row = document.createElement('div');
    row.className = 'gs-poll-option';
    row.innerHTML = `
      <div class="gs-poll-option-row">
        <span class="gs-poll-option-label">${label}</span>
        <span class="gs-poll-option-pct">0%</span>
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
    QRCode.toDataURL(voteUrl, { width: 140, margin: 1, color: { dark: '#000000', light: '#ffffff' } }),
  ).then((dataUrl) => {
    if (qrImg) qrImg.src = dataUrl;
  }).catch((err: unknown) => {
    log.warn({ err }, 'QR code generation failed');
  });

  let chart: Chart | null = null;

  function update(counts: number[], frozen: boolean): void {
    const total = counts.reduce((a, b) => a + b, 0);
    if (countEl) countEl.textContent = `${String(total)} vote${total === 1 ? '' : 's'}`;

    counts.forEach((c, i) => {
      const entry = optionEls[i];
      if (!entry) return;
      const pct = total > 0 ? Math.round((c / total) * 100) : 0;
      entry.bar.style.width = `${String(pct)}%`;
      entry.pct.textContent = `${String(pct)}%`;
    });

    if (frozen) {
      if (qrWrap) qrWrap.style.display = 'none';
      if (chartCanvas) chartCanvas.classList.add('visible');
      if (frozenBadge) frozenBadge.classList.add('visible');
      if (freezeBtn) { freezeBtn.disabled = true; freezeBtn.style.display = 'none'; }

      if (!chart && chartCanvas) {
        chart = new Chart(chartCanvas, {
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
            responsive: false,
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
        chartCanvas.width = 460;
        chartCanvas.height = Math.max(120, options.length * 50);
        chart.resize();
      } else if (chart) {
        const ds = chart.data.datasets[0];
        if (ds) ds.data = counts;
        chart.update();
      }
    } else {
      if (qrWrap) qrWrap.style.display = '';
      if (chartCanvas) chartCanvas.classList.remove('visible');
      if (frozenBadge) frozenBadge.classList.remove('visible');
      if (freezeBtn) { freezeBtn.disabled = false; }
    }
  }

  function destroy(): void {
    chart?.destroy();
    chart = null;
  }

  return { el, update, destroy };
}

/* ---- Viewer panel (clickable options + HTTP vote) ---- */

function buildViewerPanel(
  options: string[],
  room: string,
  slideIndex: number,
  isFrozen: () => boolean,
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

    counts.forEach((c, i) => {
      const pct = total > 0 ? Math.round((c / total) * 100) : 0;
      const pctEl = pctEls[i];
      const bar = bars[i];
      if (pctEl) pctEl.textContent = `${String(pct)}%`;
      if (bar) bar.style.width = `${String(pct)}%`;
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
    const syncMap = ctx.sync?.getSharedMap() ?? null;
    const isPresenter = ctx.role === 'presenter';
    const isViewer = ctx.sync?.readonly === true;

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

    // Presenter writes options to Yjs so the voter page can read them
    if (syncMap && isPresenter) {
      ctx.syncManager?.doc.transact(() => {
        pollSlides.forEach((options, slideIndex) => {
          syncMap.set(keyOptions(slideIndex), JSON.stringify(options));
        });
      });
    }

    let currentPanel: PollPanel | null = null;
    let currentSlideIndex = -1;

    function showPollForSlide(slideIndex: number): void {
      if (currentPanel) {
        currentPanel.destroy();
        currentPanel.el.remove();
        currentPanel = null;
      }

      const options = pollSlides.get(slideIndex);
      if (!options) {
        currentSlideIndex = -1;
        return;
      }

      currentSlideIndex = slideIndex;

      let panel: PollPanel;

      if (isViewer) {
        panel = buildViewerPanel(options, room, slideIndex, () =>
          syncMap?.get(keyFrozen(slideIndex)) === true,
        );
      } else {
        const voteUrl = `${location.origin}/vote.html?room=${encodeURIComponent(room)}&slide=${String(slideIndex)}`;
        panel = buildPresenterPanel(options, voteUrl, () => {
          if (!syncMap || !isPresenter) return;
          syncMap.set(keyFrozen(slideIndex), true);
        });
      }

      ctx.container.appendChild(panel.el);
      currentPanel = panel;

      // Mark active in Yjs (presenter only)
      if (syncMap && isPresenter) {
        syncMap.set(keyActive(slideIndex), true);
      }

      // Initial render
      const counts = syncMap
        ? countVotes(syncMap, slideIndex, options.length)
        : new Array<number>(options.length).fill(0);
      const frozen = syncMap ? (syncMap.get(keyFrozen(slideIndex)) === true) : false;
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

    let unobserve: (() => void) | null = null;
    if (syncMap) {
      const observer = (): void => {
        if (currentSlideIndex < 0 || !currentPanel) return;
        const options = pollSlides.get(currentSlideIndex);
        if (!options) return;
        const counts = countVotes(syncMap, currentSlideIndex, options.length);
        const frozen = syncMap.get(keyFrozen(currentSlideIndex)) === true;
        currentPanel.update(counts, frozen);
      };
      syncMap.observe(observer);
      unobserve = () => { syncMap.unobserve(observer); };
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
      unobserve?.();
      hidePoll();
      styleEl.remove();
    };
  },
};

