// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Y from 'yjs';

vi.mock('../../src/logging.ts', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// Stub Chart.js — we test that Chart is instantiated/destroyed, not rendering
const { MockChart, mockChartDestroy } = vi.hoisted(() => {
  const mockChartDestroy = vi.fn();
  const MockChart = vi.fn().mockImplementation(() => ({
    destroy: mockChartDestroy,
    update: vi.fn(),
    resize: vi.fn(),
    data: { datasets: [{ data: [] as unknown[] }] },
  }));
  return { MockChart, mockChartDestroy };
});

vi.mock('chart.js', () => ({
  Chart: Object.assign(MockChart, { register: vi.fn() }),
  BarController: {},
  CategoryScale: {},
  LinearScale: {},
  BarElement: {},
  Tooltip: {},
}));

// Stub qrcode — we don't need real QR images in unit tests
vi.mock('qrcode', () => ({
  toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,stub'),
}));

import { getPollSlides, countVotes, pollFeature } from '../../src/features/builtins/poll-feature.ts';
import type { FeatureContext, FeatureSyncAPI } from '../../src/features/types.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the three-level DOM nesting the poll feature relies on:
 *   .gs-container > .gs-features > div[data-feature="poll"]  (ctx.container)
 */
function makeContainer(): { container: HTMLElement; gsContainer: HTMLElement } {
  const gsContainer = document.createElement('div');
  gsContainer.className = 'gs-container';
  const gsFeatures = document.createElement('div');
  gsFeatures.className = 'gs-features';
  const container = document.createElement('div');
  container.setAttribute('data-feature', 'poll');
  gsFeatures.appendChild(container);
  gsContainer.appendChild(gsFeatures);
  document.body.appendChild(gsContainer);
  return { container, gsContainer };
}

/** Append a `<geek-slide>` stub to gsContainer with a shadow root
 *  containing `<section class="content [.poll]">` and optional `<li>` items.
 */
function addSlide(
  gsContainer: HTMLElement,
  opts: { poll?: boolean; items?: string[] } = {},
): HTMLElement {
  if (!customElements.get('geek-slide')) {
    customElements.define('geek-slide', class extends HTMLElement {
      constructor() { super(); this.attachShadow({ mode: 'open' }); }
    });
  }
  const slide = document.createElement('geek-slide');
  const section = document.createElement('section');
  section.className = 'content';
  if (opts.poll) section.classList.add('poll');
  (opts.items ?? []).forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    section.appendChild(li);
  });
  slide.shadowRoot!.appendChild(section);
  gsContainer.appendChild(slide);
  return slide;
}

/** Build a Yjs Y.Map that backs the poll's shared state. */
function makeYMap(initial: Record<string, unknown> = {}): Y.Map<unknown> {
  const doc = new Y.Doc();
  const map = doc.getMap<unknown>('poll');
  doc.transact(() => {
    for (const [k, v] of Object.entries(initial)) map.set(k, v);
  });
  return map;
}

type EventHandler = (payload: Record<string, unknown>) => void;

function makeCtx(
  container: HTMLElement,
  opts: {
    role?: 'presenter' | 'viewer';
    syncMap?: Y.Map<unknown> | null;
    readonly?: boolean;
    currentSlide?: number;
  } = {},
): FeatureContext {
  const role = opts.role ?? 'presenter';
  const syncMap = opts.syncMap ?? null;
  const isReadonly = opts.readonly ?? false;

  const handlers = new Map<string, EventHandler[]>();
  const onFn = vi.fn((event: string, handler: EventHandler) => {
    const list = handlers.get(event) ?? [];
    list.push(handler);
    handlers.set(event, list);
    return vi.fn();
  }) as unknown as FeatureContext['on'];

  const sync: FeatureSyncAPI | null = syncMap
    ? {
        connected: true,
        readonly: isReadonly,
        getSharedMap: () => syncMap,
        getSharedArray: () => new Y.Array(),
      }
    : null;

  return {
    featureId: 'poll',
    config: { sync: { room: 'test-room' } } as never,
    role,
    slideshow: { currentSlide: opts.currentSlide ?? 0, slideCount: 5, mode: 'present' } as never,
    commands: { register: vi.fn() } as never,
    sync,
    syncManager: null,
    container,
    on: onFn,
    output: { show: vi.fn() },
  };
}

/** Fire all handlers registered for an event. */
function fire(ctx: FeatureContext, event: string, payload: Record<string, unknown>): void {
  const on = ctx.on as ReturnType<typeof vi.fn>;
  on.mock.calls
    .filter(([e]: [string]) => e === event)
    .forEach(([, handler]: [string, EventHandler]) => { handler(payload); });
}

// ---------------------------------------------------------------------------
// getPollSlides
// ---------------------------------------------------------------------------

describe('getPollSlides()', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('returns empty map when there are no slides', () => {
    const { container } = makeContainer();
    expect(getPollSlides(container).size).toBe(0);
  });

  it('returns empty map when slides exist but none has .poll class', () => {
    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { items: ['A', 'B'] });
    expect(getPollSlides(container).size).toBe(0);
  });

  it('returns empty map when .poll slide has fewer than 2 items', () => {
    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['only one'] });
    expect(getPollSlides(container).size).toBe(0);
  });

  it('detects a single poll slide with 2+ items', () => {
    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['Alpha', 'Beta', 'Gamma'] });
    const result = getPollSlides(container);
    expect(result.size).toBe(1);
    expect(result.get(0)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('maps correct slide index when poll is not the first slide', () => {
    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { items: ['not a poll'] });  // index 0 — no .poll
    addSlide(gsContainer, { poll: true, items: ['X', 'Y'] }); // index 1
    const result = getPollSlides(container);
    expect(result.has(0)).toBe(false);
    expect(result.get(1)).toEqual(['X', 'Y']);
  });

  it('detects multiple poll slides at their correct indices', () => {
    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['A', 'B'] });   // 0
    addSlide(gsContainer, { items: ['not poll'] });               // 1
    addSlide(gsContainer, { poll: true, items: ['P', 'Q', 'R'] }); // 2
    const result = getPollSlides(container);
    expect(result.size).toBe(2);
    expect(result.get(0)).toEqual(['A', 'B']);
    expect(result.get(2)).toEqual(['P', 'Q', 'R']);
  });

  it('returns empty map when container has no parent', () => {
    const detached = document.createElement('div');
    expect(getPollSlides(detached).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// countVotes
// ---------------------------------------------------------------------------

describe('countVotes()', () => {
  it('returns all zeros when there are no votes', () => {
    const map = makeYMap({});
    expect(countVotes(map, 0, 3)).toEqual([0, 0, 0]);
  });

  it('counts a single vote correctly', () => {
    const map = makeYMap({ 'slide-0-vote-voter1': 2 });
    expect(countVotes(map, 0, 3)).toEqual([0, 0, 1]);
  });

  it('counts unanimous votes', () => {
    const map = makeYMap({
      'slide-0-vote-v1': 1,
      'slide-0-vote-v2': 1,
      'slide-0-vote-v3': 1,
    });
    expect(countVotes(map, 0, 3)).toEqual([0, 3, 0]);
  });

  it('counts distributed votes across all options', () => {
    const map = makeYMap({
      'slide-0-vote-v1': 0,
      'slide-0-vote-v2': 1,
      'slide-0-vote-v3': 2,
      'slide-0-vote-v4': 0,
    });
    expect(countVotes(map, 0, 3)).toEqual([2, 1, 1]);
  });

  it('ignores votes for a different slide index', () => {
    const map = makeYMap({
      'slide-1-vote-v1': 0,  // slide 1, not slide 0
      'slide-0-vote-v2': 0,
    });
    expect(countVotes(map, 0, 2)).toEqual([1, 0]);
  });

  it('ignores keys that are not vote keys', () => {
    const map = makeYMap({
      'slide-0-frozen': true,
      'slide-0-options': '["A","B"]',
      'slide-0-vote-v1': 1,
    });
    expect(countVotes(map, 0, 2)).toEqual([0, 1]);
  });

  it('ignores vote values that are out of range', () => {
    const map = makeYMap({
      'slide-0-vote-v1': 99,   // out of range
      'slide-0-vote-v2': -1,   // negative
      'slide-0-vote-v3': 'bad', // wrong type
      'slide-0-vote-v4': 0,    // valid
    });
    expect(countVotes(map, 0, 2)).toEqual([1, 0]);
  });
});

// ---------------------------------------------------------------------------
// pollFeature — metadata
// ---------------------------------------------------------------------------

describe('pollFeature metadata', () => {
  it('has id "poll"', () => { expect(pollFeature.id).toBe('poll'); });
  it('has a non-empty label', () => { expect(pollFeature.label.length).toBeGreaterThan(0); });
});

// ---------------------------------------------------------------------------
// pollFeature.activate — no poll slides
// ---------------------------------------------------------------------------

describe('pollFeature.activate() — no poll slides', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('returns a cleanup fn even when there are no poll slides', () => {
    const { container } = makeContainer();
    const ctx = makeCtx(container);
    const cleanup = pollFeature.activate(ctx);
    expect(typeof cleanup).toBe('function');
  });

  it('injects a <style> element and removes it on cleanup', () => {
    const { container } = makeContainer();
    const ctx = makeCtx(container);
    const cleanup = pollFeature.activate(ctx)!;
    expect(container.querySelector('style')).not.toBeNull();
    cleanup();
    expect(container.querySelector('style')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// pollFeature.activate — presenter mode
// ---------------------------------------------------------------------------

describe('pollFeature.activate() — presenter mode', () => {
  beforeEach(() => { document.body.innerHTML = ''; MockChart.mockClear(); mockChartDestroy.mockClear(); });

  it('shows the poll panel when the current slide is a poll slide', () => {
    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['A', 'B', 'C'] });
    const map = makeYMap({});
    const ctx = makeCtx(container, { role: 'presenter', syncMap: map, currentSlide: 0 });
    pollFeature.activate(ctx);
    expect(container.querySelector('.gs-poll-panel')).not.toBeNull();
  });

  it('shows no panel when starting on a non-poll slide', () => {
    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['A', 'B'] });
    const map = makeYMap({});
    const ctx = makeCtx(container, { role: 'presenter', syncMap: map, currentSlide: 1 });
    pollFeature.activate(ctx);
    expect(container.querySelector('.gs-poll-panel')).toBeNull();
  });

  it('shows the freeze button for the presenter', () => {
    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['A', 'B'] });
    const ctx = makeCtx(container, { role: 'presenter', syncMap: makeYMap({}), currentSlide: 0 });
    pollFeature.activate(ctx);
    expect(container.querySelector('.gs-poll-freeze-btn')).not.toBeNull();
  });

  it('updates vote counts reactively when Yjs map changes', () => {
    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['Yes', 'No'] });
    const doc = new Y.Doc();
    const map = doc.getMap<unknown>('poll');
    const ctx = makeCtx(container, { role: 'presenter', syncMap: map, currentSlide: 0 });
    pollFeature.activate(ctx);

    const countEl = container.querySelector<HTMLElement>('.gs-poll-count');
    expect(countEl?.textContent).toContain('0');

    doc.transact(() => { map.set('slide-0-vote-v1', 0); });
    expect(countEl?.textContent).toContain('1');

    doc.transact(() => { map.set('slide-0-vote-v2', 1); });
    expect(countEl?.textContent).toContain('2');
  });

  it('freeze button click writes frozen=true to syncMap', () => {
    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['A', 'B'] });
    const doc = new Y.Doc();
    const map = doc.getMap<unknown>('poll');
    const ctx = makeCtx(container, { role: 'presenter', syncMap: map, currentSlide: 0 });
    pollFeature.activate(ctx);

    const btn = container.querySelector<HTMLButtonElement>('.gs-poll-freeze-btn')!;
    btn.click();
    expect(map.get('slide-0-frozen')).toBe(true);
  });

  it('updates the panel to frozen state when Yjs frozen key is set', () => {
    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['X', 'Y'] });
    const doc = new Y.Doc();
    const map = doc.getMap<unknown>('poll');
    const ctx = makeCtx(container, { role: 'presenter', syncMap: map, currentSlide: 0 });
    pollFeature.activate(ctx);

    doc.transact(() => { map.set('slide-0-frozen', true); });

    // QR should be hidden; chart should be visible
    const qrWrap = container.querySelector<HTMLElement>('.gs-poll-qr');
    expect(qrWrap?.style.display).toBe('none');
    expect(container.querySelector('.gs-poll-chart-wrap')?.classList.contains('visible')).toBe(true);
  });

  it('instantiates a Chart instance on freeze', () => {
    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['A', 'B'] });
    const doc = new Y.Doc();
    const map = doc.getMap<unknown>('poll');
    const ctx = makeCtx(container, { role: 'presenter', syncMap: map, currentSlide: 0 });
    pollFeature.activate(ctx);
    expect(MockChart).not.toHaveBeenCalled();

    doc.transact(() => { map.set('slide-0-frozen', true); });
    expect(MockChart).toHaveBeenCalledOnce();
  });

  it('shows panel on slide:enter for a poll slide', () => {
    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { items: ['not poll'] });             // slide 0
    addSlide(gsContainer, { poll: true, items: ['P', 'Q'] });  // slide 1
    const ctx = makeCtx(container, { role: 'presenter', syncMap: makeYMap({}), currentSlide: 0 });
    pollFeature.activate(ctx);
    expect(container.querySelector('.gs-poll-panel')).toBeNull();

    fire(ctx, 'slide:enter', { slideIndex: 1, previousIndex: 0 });
    expect(container.querySelector('.gs-poll-panel')).not.toBeNull();
  });

  it('hides panel on slide:leave', () => {
    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['A', 'B'] });
    const ctx = makeCtx(container, { role: 'presenter', syncMap: makeYMap({}), currentSlide: 0 });
    pollFeature.activate(ctx);
    expect(container.querySelector('.gs-poll-panel')).not.toBeNull();

    fire(ctx, 'slide:leave', { slideIndex: 0, nextIndex: 1 });
    expect(container.querySelector('.gs-poll-panel')).toBeNull();
  });

  it('replaces panel when entering a different poll slide', () => {
    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['A', 'B'] });    // 0
    addSlide(gsContainer, { poll: true, items: ['X', 'Y', 'Z'] }); // 1
    const ctx = makeCtx(container, { role: 'presenter', syncMap: makeYMap({}), currentSlide: 0 });
    pollFeature.activate(ctx);

    fire(ctx, 'slide:leave', { slideIndex: 0, nextIndex: 1 });
    fire(ctx, 'slide:enter', { slideIndex: 1, previousIndex: 0 });

    const panels = container.querySelectorAll('.gs-poll-panel');
    expect(panels.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// pollFeature.activate — viewer mode
// ---------------------------------------------------------------------------

describe('pollFeature.activate() — viewer mode', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('shows clickable option buttons instead of QR in viewer mode', () => {
    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['Coffee', 'Tea'] });
    const ctx = makeCtx(container, {
      role: 'viewer',
      syncMap: makeYMap({}),
      readonly: true,
      currentSlide: 0,
    });
    pollFeature.activate(ctx);

    expect(container.querySelector('.gs-poll-voter-btn')).not.toBeNull();
    expect(container.querySelector('.gs-poll-qr')).toBeNull();
  });

  it('does NOT show the freeze button for viewers', () => {
    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['A', 'B'] });
    const ctx = makeCtx(container, {
      role: 'viewer',
      syncMap: makeYMap({}),
      readonly: true,
      currentSlide: 0,
    });
    pollFeature.activate(ctx);
    expect(container.querySelector('.gs-poll-freeze-btn')).toBeNull();
  });

  it('renders one button per option', () => {
    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['One', 'Two', 'Three'] });
    const ctx = makeCtx(container, {
      role: 'viewer',
      syncMap: makeYMap({}),
      readonly: true,
      currentSlide: 0,
    });
    pollFeature.activate(ctx);
    expect(container.querySelectorAll('.gs-poll-voter-btn').length).toBe(3);
  });

  it('clicking a button submits a POST to /api/feature-write', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['A', 'B'] });
    const ctx = makeCtx(container, {
      role: 'viewer',
      syncMap: makeYMap({}),
      readonly: true,
      currentSlide: 0,
    });

    // Stub localStorage
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
    });
    // Stub crypto.randomUUID
    vi.stubGlobal('crypto', { randomUUID: () => 'test-voter-uuid' });

    pollFeature.activate(ctx);
    const btns = container.querySelectorAll<HTMLButtonElement>('.gs-poll-voter-btn');
    btns[1]!.click();
    await Promise.resolve(); // flush microtasks

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/feature-write',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"featureId":"poll"'),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ room: 'test-room', featureId: 'poll' });
    const updates = body.updates as Record<string, unknown>;
    expect(Object.values(updates)[0]).toBe(1); // option index 1

    vi.unstubAllGlobals();
  });

  it('disables all buttons after voting', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    vi.stubGlobal('localStorage', { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn() });
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-x' });

    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['A', 'B', 'C'] });
    const ctx = makeCtx(container, {
      role: 'viewer',
      syncMap: makeYMap({}),
      readonly: true,
      currentSlide: 0,
    });
    pollFeature.activate(ctx);

    const btns = container.querySelectorAll<HTMLButtonElement>('.gs-poll-voter-btn');
    btns[0]!.click();
    btns.forEach((b) => { expect(b.disabled).toBe(true); });
    expect(btns[0]!.classList.contains('selected')).toBe(true);

    vi.unstubAllGlobals();
  });

  it('does not POST if poll is frozen when button is clicked', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn() });
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-y' });

    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['A', 'B'] });
    const doc = new Y.Doc();
    const map = doc.getMap<unknown>('poll');
    doc.transact(() => { map.set('slide-0-frozen', true); });

    const ctx = makeCtx(container, {
      role: 'viewer',
      syncMap: map,
      readonly: true,
      currentSlide: 0,
    });
    pollFeature.activate(ctx);

    const btns = container.querySelectorAll<HTMLButtonElement>('.gs-poll-voter-btn');
    btns[0]!.click();
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('pre-selects saved vote from localStorage and disables buttons', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => (key.includes('voted') ? '1' : null)),
      setItem: vi.fn(),
    });
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-z' });

    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['A', 'B', 'C'] });
    const ctx = makeCtx(container, {
      role: 'viewer',
      syncMap: makeYMap({}),
      readonly: true,
      currentSlide: 0,
    });
    pollFeature.activate(ctx);

    const btns = container.querySelectorAll<HTMLButtonElement>('.gs-poll-voter-btn');
    expect(btns[1]!.classList.contains('selected')).toBe(true);
    btns.forEach((b) => { expect(b.disabled).toBe(true); });

    vi.unstubAllGlobals();
  });

  it('updates vote bars when Yjs votes arrive', () => {
    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['A', 'B'] });
    const doc = new Y.Doc();
    const map = doc.getMap<unknown>('poll');
    const ctx = makeCtx(container, {
      role: 'viewer',
      syncMap: map,
      readonly: true,
      currentSlide: 0,
    });
    pollFeature.activate(ctx);

    const countEl = container.querySelector<HTMLElement>('.gs-poll-count');
    expect(countEl?.textContent).toContain('0');

    doc.transact(() => { map.set('slide-0-vote-remote1', 0); });
    expect(countEl?.textContent).toContain('1');
  });

  it('shows frozen indicator when poll freezes via Yjs', () => {
    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['A', 'B'] });
    const doc = new Y.Doc();
    const map = doc.getMap<unknown>('poll');
    const ctx = makeCtx(container, {
      role: 'viewer',
      syncMap: map,
      readonly: true,
      currentSlide: 0,
    });
    pollFeature.activate(ctx);

    const frozenEl = container.querySelector<HTMLElement>('.gs-poll-frozen-viewer');
    expect(frozenEl?.classList.contains('visible')).toBe(false);

    doc.transact(() => { map.set('slide-0-frozen', true); });
    expect(frozenEl?.classList.contains('visible')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// pollFeature.activate — cleanup
// ---------------------------------------------------------------------------

describe('pollFeature.activate() — cleanup', () => {
  beforeEach(() => { document.body.innerHTML = ''; MockChart.mockClear(); mockChartDestroy.mockClear(); });

  it('removes the panel from the DOM on cleanup', () => {
    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['A', 'B'] });
    const ctx = makeCtx(container, { syncMap: makeYMap({}), currentSlide: 0 });
    const cleanup = pollFeature.activate(ctx)!;
    expect(container.querySelector('.gs-poll-panel')).not.toBeNull();
    cleanup();
    expect(container.querySelector('.gs-poll-panel')).toBeNull();
  });

  it('removes the <style> element on cleanup', () => {
    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['A', 'B'] });
    const ctx = makeCtx(container, { syncMap: makeYMap({}), currentSlide: 0 });
    const cleanup = pollFeature.activate(ctx)!;
    cleanup();
    expect(container.querySelector('style')).toBeNull();
  });

  it('destroys the Chart instance on cleanup after freeze', () => {
    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['A', 'B'] });
    const doc = new Y.Doc();
    const map = doc.getMap<unknown>('poll');
    const ctx = makeCtx(container, { syncMap: map, currentSlide: 0 });
    const cleanup = pollFeature.activate(ctx)!;

    doc.transact(() => { map.set('slide-0-frozen', true); });
    expect(MockChart).toHaveBeenCalledOnce();

    cleanup();
    expect(mockChartDestroy).toHaveBeenCalledOnce();
  });

  it('unsubscribes from Yjs observer on cleanup (no more updates)', () => {
    const { container, gsContainer } = makeContainer();
    addSlide(gsContainer, { poll: true, items: ['A', 'B'] });
    const doc = new Y.Doc();
    const map = doc.getMap<unknown>('poll');
    const ctx = makeCtx(container, { syncMap: map, currentSlide: 0 });
    const cleanup = pollFeature.activate(ctx)!;

    const countEl = container.querySelector<HTMLElement>('.gs-poll-count');
    doc.transact(() => { map.set('slide-0-vote-v1', 0); });
    expect(countEl?.textContent).toContain('1');

    cleanup();

    // After cleanup, panel is gone; observer must not throw on later Yjs changes
    expect(() => {
      doc.transact(() => { map.set('slide-0-vote-v2', 1); });
    }).not.toThrow();
  });
});
