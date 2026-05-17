/**
 * GeekSlides — Live Poll voter page script.
 *
 * Connects to the same Yjs room as the presentation, reads poll options,
 * and submits one vote per browser (voter ID stored in localStorage).
 *
 * Options are fetched from /api/poll-options on load for instant display so
 * the page is usable even before the WebSocket sync completes.  Votes are
 * submitted via the HTTP /api/feature-write endpoint (reliable from phones);
 * the WebSocket is used only for live vote counts and the frozen state.
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

/* ------------------------------------------------------------------ */
/*  URL parameters                                                     */
/* ------------------------------------------------------------------ */

const params = new URLSearchParams(location.search);
const room = params.get('room') ?? 'default';
const slideIndex = parseInt(params.get('slide') ?? '0', 10);

/* ------------------------------------------------------------------ */
/*  Options — fetched from server for instant render, fallback to Yjs  */
/* ------------------------------------------------------------------ */

/** @type {string[] | null} */
let options = null;

/* ------------------------------------------------------------------ */
/*  Voter identity (one UUID per browser, persisted in localStorage)   */
/* ------------------------------------------------------------------ */

/** UUID v4 with fallback for iOS < 15.4 / older Android */
function randomUUID() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC 4122
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const VOTER_ID_KEY = 'geekslides-voter-id';
let voterId = localStorage.getItem(VOTER_ID_KEY);
if (!voterId) {
  voterId = randomUUID();
  localStorage.setItem(VOTER_ID_KEY, voterId);
}

const VOTED_KEY = `geekslides-voted-${room}-${slideIndex}`;

/* ------------------------------------------------------------------ */
/*  Yjs key helpers (must match poll-feature.ts)                       */
/* ------------------------------------------------------------------ */

const keyOptions = (i) => `slide-${i}-options`;
const keyFrozen = (i) => `slide-${i}-frozen`;
const keyVote = (i, vid) => `slide-${i}-vote-${vid}`;
const votePrefix = (i) => `slide-${i}-vote-`;

/* ------------------------------------------------------------------ */
/*  DOM helpers                                                        */
/* ------------------------------------------------------------------ */

const contentEl = document.getElementById('content');
const subtitleEl = document.getElementById('subtitle');

function setSubtitle(text) {
  if (subtitleEl) subtitleEl.textContent = text;
}

function render(html) {
  if (contentEl) contentEl.innerHTML = html;
}

/* ------------------------------------------------------------------ */
/*  Vote state                                                         */
/* ------------------------------------------------------------------ */

const savedVote = localStorage.getItem(VOTED_KEY);
/** @type {number | null} confirmed vote index */
let selectedIdx = savedVote !== null ? parseInt(savedVote, 10) : null;
/** @type {number | null} vote in-flight (not yet confirmed by server) */
let pendingIdx = null;
/** @type {number[] | null} live counts from Yjs — null until WS syncs */
let liveCounts = null;
let isFrozen = false;

/* ------------------------------------------------------------------ */
/*  Vote counting                                                      */
/* ------------------------------------------------------------------ */

function countVotes(pollMap, optionCount) {
  const counts = new Array(optionCount).fill(0);
  const prefix = votePrefix(slideIndex);
  pollMap.forEach((value, key) => {
    if (!key.startsWith(prefix)) return;
    const idx = typeof value === 'number' ? value : -1;
    if (idx >= 0 && idx < optionCount) counts[idx]++;
  });
  return counts;
}

/* ------------------------------------------------------------------ */
/*  HTML escaping                                                      */
/* ------------------------------------------------------------------ */

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------------ */
/*  Render helpers                                                     */
/* ------------------------------------------------------------------ */

function renderResults(opts, counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  const rows = opts.map((label, i) => {
    const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
    return `
      <div class="result-row">
        <div class="result-row-top">
          <span class="result-label">${escHtml(label)}</span>
          <span class="result-pct">${pct}%</span>
        </div>
        <div class="result-bar-wrap">
          <div class="result-bar" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');

  const votedMsg = selectedIdx !== null
    ? `<div class="toast visible">✅ Your vote has been recorded!</div>`
    : '';

  render(`
    <div class="frozen-banner visible">🔒 Poll closed — results below</div>
    <div class="results">${rows}</div>
    ${votedMsg}
    <p class="vote-count">${total} total vote${total === 1 ? '' : 's'}</p>
  `);
}

function renderOptions(opts, counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  const hasVoted = selectedIdx !== null;
  const isSubmitting = pendingIdx !== null;
  const disabled = hasVoted || isSubmitting;

  const btns = opts.map((label, i) => {
    const isSelected = i === selectedIdx;
    return `
      <button class="option-btn${isSelected ? ' selected' : ''}"
              data-idx="${i}"
              ${disabled ? 'disabled' : ''}>
        <span>${escHtml(label)}</span>
        ${isSelected ? '<span class="check">✓</span>' : ''}
      </button>`;
  }).join('');

  const toast = hasVoted
    ? `<div class="toast visible">✅ Your vote has been recorded!</div>`
    : isSubmitting
      ? `<div class="toast visible" style="background:rgba(99,179,237,0.08);border-color:#63b3ed;color:#63b3ed">Submitting…</div>`
      : '';

  render(`
    <div class="options">${btns}</div>
    ${toast}
    <p class="vote-count">${total} vote${total === 1 ? '' : 's'} so far</p>
  `);

  if (!disabled) {
    contentEl?.querySelectorAll('.option-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx ?? '-1', 10);
        if (idx < 0) return;
        submitVote(idx);
      });
    });
  }
}

function refresh() {
  if (!options) return;
  const counts = liveCounts ?? new Array(options.length).fill(0);
  if (isFrozen) {
    renderResults(options, counts);
  } else {
    renderOptions(options, counts);
  }
}

/* ------------------------------------------------------------------ */
/*  Vote submission via HTTP (reliable from phones / external nets)   */
/* ------------------------------------------------------------------ */

function submitVote(idx) {
  if (pendingIdx !== null || selectedIdx !== null) return;
  pendingIdx = idx;
  refresh(); // show "Submitting…" and disable buttons immediately

  fetch('/api/feature-write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room,
      featureId: 'poll',
      updates: { [keyVote(slideIndex, voterId)]: idx },
    }),
  })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      // Only persist the vote after the server confirms it
      selectedIdx = idx;
      localStorage.setItem(VOTED_KEY, String(idx));
      pendingIdx = null;
      refresh();
    })
    .catch(() => {
      pendingIdx = null;
      render(`<div class="status" style="color:#fc8181">Could not submit vote — please try again.</div>`);
      setTimeout(() => { refresh(); }, 2500);
    });
}

/* ------------------------------------------------------------------ */
/*  Immediate render — fetch options from server API                  */
/* ------------------------------------------------------------------ */

const vtokenParam = params.get('vtoken');
const vtokenQuery = vtokenParam ? `&vtoken=${encodeURIComponent(vtokenParam)}` : '';

fetch(`/api/poll-options?room=${encodeURIComponent(room)}&slide=${slideIndex}${vtokenQuery}`)
  .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
  .then((data) => {
    if (Array.isArray(data.options) && data.options.length > 0) {
      options = data.options;
      isFrozen = data.frozen === true;
      setSubtitle(`Room: ${room}`);
      refresh();
    }
  })
  .catch(() => { /* will fall back to WebSocket sync */ });

/* ------------------------------------------------------------------ */
/*  WebSocket sync — for live vote counts and frozen state            */
/* ------------------------------------------------------------------ */

const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

// Pass vtoken so protected rooms allow viewer access
const wsParams = vtokenParam ? { vtoken: vtokenParam } : {};

const doc = new Y.Doc();
const provider = new WebsocketProvider(wsUrl, room, doc, { params: wsParams });

if (!options) setSubtitle(`Room: ${room}`);

provider.on('status', ({ status }) => {
  if (status === 'disconnected') {
    setSubtitle('Disconnected — reconnecting…');
  } else if (status === 'connecting') {
    if (!options) setSubtitle(`Room: ${room}`);
  }
});

provider.on('sync', (synced) => {
  if (!synced) return;
  setSubtitle(`Room: ${room}`);

  const featuresMap = doc.getMap('features');

  function tryInitFromYjs() {
    const pollMap = featuresMap.get('poll');
    if (!(pollMap instanceof Y.Map)) return;

    // Resolve options from Yjs if not already available from URL
    if (!options) {
      const optionsJson = pollMap.get(keyOptions(slideIndex));
      if (typeof optionsJson !== 'string') return;
      try {
        const parsed = JSON.parse(optionsJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          options = parsed;
        } else return;
      } catch { return; }
    }

    function onYjsChange() {
      liveCounts = countVotes(pollMap, options.length);
      isFrozen = pollMap.get(keyFrozen(slideIndex)) === true;
      refresh();
    }

    pollMap.observe(onYjsChange);
    onYjsChange(); // initial render with live data
  }

  tryInitFromYjs();
  featuresMap.observe(() => { tryInitFromYjs(); });
});

/* ------------------------------------------------------------------ */
/*  Fallback: no opts in URL and WS never synced                      */
/* ------------------------------------------------------------------ */

setTimeout(() => {
  if (!options) {
    render('<div class="status">Could not connect to the presentation server.<br>Make sure you are on the same network.</div>');
  }
}, 8000);
