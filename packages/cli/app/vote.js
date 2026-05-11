/**
 * GeekSlides — Live Poll voter page script.
 *
 * Connects to the same Yjs room as the presentation, reads poll options,
 * and submits one vote per browser (voter ID stored in localStorage).
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
/*  Voter identity (one UUID per browser, persisted in localStorage)   */
/* ------------------------------------------------------------------ */

const VOTER_ID_KEY = 'geekslides-voter-id';
let voterId = localStorage.getItem(VOTER_ID_KEY);
if (!voterId) {
  voterId = crypto.randomUUID();
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
/*  Render: results view                                               */
/* ------------------------------------------------------------------ */

function renderResults(options, counts, message = '') {
  const total = counts.reduce((a, b) => a + b, 0);
  const rows = options.map((label, i) => {
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

  render(`
    <div class="frozen-banner visible">🔒 Poll closed — results below</div>
    <div class="results">${rows}</div>
    ${message ? `<div class="toast visible">${message}</div>` : ''}
    <p class="vote-count">${total} total vote${total === 1 ? '' : 's'}</p>
  `);
}

/* ------------------------------------------------------------------ */
/*  Render: voting view                                                */
/* ------------------------------------------------------------------ */

function renderOptions(options, pollMap, selectedIdx) {
  const counts = countVotes(pollMap, options.length);
  const total = counts.reduce((a, b) => a + b, 0);
  const hasVoted = selectedIdx !== null;

  const btns = options.map((label, i) => {
    const isSelected = i === selectedIdx;
    return `
      <button class="option-btn${isSelected ? ' selected' : ''}"
              data-idx="${i}"
              ${hasVoted ? 'disabled' : ''}>
        <span>${escHtml(label)}</span>
        ${isSelected ? '<span class="check">✓</span>' : ''}
      </button>`;
  }).join('');

  render(`
    <div class="options">${btns}</div>
    ${hasVoted ? `<div class="toast visible">✅ Your vote has been recorded!</div>` : ''}
    <p class="vote-count">${total} vote${total === 1 ? '' : 's'} so far</p>
  `);

  // Attach click handlers if not yet voted
  if (!hasVoted) {
    contentEl?.querySelectorAll('.option-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx ?? '-1', 10);
        if (idx < 0) return;

        // Write vote to Yjs
        const voteKey = keyVote(slideIndex, voterId);
        pollMap.set(voteKey, idx);

        // Persist locally so page reload shows "already voted"
        localStorage.setItem(VOTED_KEY, String(idx));

        // Re-render with selection shown
        renderOptions(options, pollMap, idx);
      });
    });
  }
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
/*  Main — connect to Yjs and initialise the poll UI                  */
/* ------------------------------------------------------------------ */

const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

const doc = new Y.Doc();
const provider = new WebsocketProvider(wsUrl, room, doc);

setSubtitle(`Room: ${room}`);

provider.on('status', ({ status }) => {
  if (status === 'disconnected') {
    setSubtitle('Disconnected — reconnecting…');
  } else if (status === 'connecting') {
    setSubtitle(`Room: ${room}`);
  }
});

provider.on('sync', (synced) => {
  if (!synced) return;

  setSubtitle(`Room: ${room}`);

  // The presenter stores poll options at features.poll (a nested Y.Map).
  // We need to wait for that nested map to exist in the synced doc.
  const featuresMap = doc.getMap('features');

  function initPoll() {
    const pollMap = featuresMap.get('poll');
    if (!(pollMap instanceof Y.Map)) return;

    const optionsJson = pollMap.get(keyOptions(slideIndex));
    if (typeof optionsJson !== 'string') return;

    let options;
    try {
      options = JSON.parse(optionsJson);
    } catch {
      render('<div class="status">Could not read poll options.</div>');
      return;
    }

    if (!Array.isArray(options) || options.length === 0) {
      render('<div class="status">No options found for this poll.</div>');
      return;
    }

    // Restore previous vote from localStorage (survives refresh)
    const savedVote = localStorage.getItem(VOTED_KEY);
    const selectedIdx = savedVote !== null ? parseInt(savedVote, 10) : null;

    function refresh() {
      const frozen = pollMap.get(keyFrozen(slideIndex)) === true;
      const counts = countVotes(pollMap, options.length);

      if (frozen) {
        const msg = selectedIdx !== null ? '✅ Your vote has been recorded!' : '';
        renderResults(options, counts, msg);
      } else {
        renderOptions(options, pollMap, selectedIdx);
      }
    }

    // Observe for live updates (votes + freeze)
    pollMap.observe(() => { refresh(); });

    // Initial render
    refresh();
  }

  // The nested poll map might not exist yet if the presenter hasn't activated it
  initPoll();
  featuresMap.observe(() => { initPoll(); });
});

// Fallback if sync never fires (e.g. no server)
setTimeout(() => {
  if (contentEl?.querySelector('.spinner')) {
    render('<div class="status">Could not connect to the presentation server.<br>Make sure you are on the same network.</div>');
  }
}, 8000);
