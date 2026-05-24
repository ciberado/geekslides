/**
 * GeekSlides v2 — QR Code Overlay Feature.
 *
 * Displays a full-screen QR code across all clients in a room when triggered
 * via the `share-qr` command. Uses Yjs shared state to synchronize display
 * across room participants. Any client can dismiss it (Esc or click).
 *
 * The QR code is generated using a minimal inline encoder optimized for
 * short alphanumeric URLs (the short URL API reduces density).
 */

import type { Feature, FeatureContext } from './types.ts';

/**
 * QR overlay feature: shows/hides a full-viewport QR overlay synchronized
 * via Yjs shared state key `qrUrl`.
 */
export function createQrOverlayFeature(): Feature {
  return {
    id: 'qr-overlay',
    label: 'QR code overlay for share links',

    activate(context: FeatureContext): (() => void) | undefined {
      const { sync } = context;
      if (!sync) return undefined;
      const syncApi = sync; // Non-null reference for closures

      let overlay: HTMLElement | null = null;

      // Use the feature's shared map (a sub-map under doc.getMap('features'))
      // for read/write of qrUrl. We observe it for changes.
      // Note: getSharedMap() may create the map — both clients do this, and Yjs
      // conflict resolution picks a winner. To handle the case where our local
      // reference becomes stale, we also set up a periodic check.
      let currentMap = syncApi.getSharedMap();
      let pollTimer: ReturnType<typeof setInterval> | null = null;

      function showQr(url: string): void {
        if (overlay) return;

        overlay = document.createElement('div');
        overlay.className = 'gs-qr-overlay';
        const canDismiss = !syncApi.readonly;
        overlay.innerHTML = `
          <style>
            .gs-qr-overlay {
              position: fixed;
              inset: 0;
              z-index: 100000;
              background: rgba(0, 0, 0, 0.92);
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              cursor: ${canDismiss ? 'pointer' : 'default'};
              animation: gs-qr-fade-in 0.2s ease-out;
            }
            @keyframes gs-qr-fade-in {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            .gs-qr-overlay canvas {
              max-width: 70vmin;
              max-height: 70vmin;
              border-radius: 12px;
              background: white;
              padding: 24px;
              box-shadow: 0 8px 48px rgba(0, 0, 0, 0.5);
            }
            .gs-qr-overlay .gs-qr-url {
              color: #8be9fd;
              font-family: 'Cascadia Code', 'Fira Code', monospace;
              font-size: 1.2rem;
              margin-top: 24px;
              text-align: center;
              word-break: break-all;
              max-width: 80vw;
            }
            .gs-qr-overlay .gs-qr-hint {
              color: rgba(255, 255, 255, 0.5);
              font-family: system-ui, sans-serif;
              font-size: 0.9rem;
              margin-top: 12px;
            }
          </style>
          <canvas></canvas>
          <div class="gs-qr-url">${escapeHtml(url)}</div>
          <div class="gs-qr-hint">${canDismiss ? 'Click or press Esc to dismiss' : 'Scan to join'}</div>
        `;

        const canvas = overlay.querySelector('canvas') as HTMLCanvasElement;
        renderQrCode(canvas, url);

        if (canDismiss) {
          overlay.addEventListener('click', dismiss);
        }
        document.body.appendChild(overlay);
      }

      function hideQr(): void {
        if (!overlay) return;
        overlay.removeEventListener('click', dismiss);
        overlay.remove();
        overlay = null;
      }

      function dismiss(): void {
        // Read-only clients cannot write to the shared doc — only presenters dismiss
        if (syncApi.readonly) return;
        // Clear shared state to dismiss on all clients — re-read map to get current
        syncApi.getSharedMap().set('qrUrl', '');
      }

      function onKeydown(e: KeyboardEvent): void {
        if (e.key === 'Escape' && overlay && !syncApi.readonly) {
          e.preventDefault();
          e.stopPropagation();
          dismiss();
        }
      }

      function onStateChange(): void {
        // Re-read from getSharedMap() to always get the winning Y.Map after conflicts
        const map = syncApi.getSharedMap();
        const url = (map.get('qrUrl') as string | undefined) ?? '';
        if (url.length > 0) {
          showQr(url);
        } else {
          hideQr();
        }

        // If the map instance changed (conflict resolved), re-attach observer
        if (map !== currentMap) {
          currentMap.unobserve(onStateChange);
          currentMap = map;
          currentMap.observe(onStateChange);
        }
      }

      currentMap.observe(onStateChange);
      document.addEventListener('keydown', onKeydown, true);

      // Poll for state changes to detect Yjs conflict resolution swapping the map.
      // This handles the race where the observer is on a dead map instance.
      pollTimer = setInterval(onStateChange, 500);

      // Check if QR is already showing when feature activates
      onStateChange();

      return () => {
        currentMap.unobserve(onStateChange);
        document.removeEventListener('keydown', onKeydown, true);
        clearInterval(pollTimer);
        hideQr();
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Minimal QR Code Generator (Version 2-6, Mode: Byte, EC Level L)   */
/* ------------------------------------------------------------------ */

/**
 * Render a QR code to a canvas element.
 * Uses a minimal encoder suitable for short URLs (up to ~100 chars).
 */
function renderQrCode(canvas: HTMLCanvasElement, text: string): void {
  const modules = generateQrModules(text);
  const size = modules.length;
  const scale = Math.max(4, Math.floor(400 / size));
  const canvasSize = size * scale;

  canvas.width = canvasSize;
  canvas.height = canvasSize;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  ctx.fillStyle = '#000000';
  for (let y = 0; y < size; y++) {
    const row = modules[y];
    if (!row) continue;
    for (let x = 0; x < size; x++) {
      if (row[x]) {
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }
}

/**
 * Generate QR code module matrix for the given text.
 * Supports byte mode, error correction level L, versions 1-10.
 */
function generateQrModules(text: string): boolean[][] {
  const data = new TextEncoder().encode(text);
  const version = selectVersion(data.length);
  const size = version * 4 + 17;

  // Initialize the matrix
  const modules: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );

  // Place finder patterns
  placeFinder(modules, reserved, 0, 0);
  placeFinder(modules, reserved, size - 7, 0);
  placeFinder(modules, reserved, 0, size - 7);

  // Place alignment patterns (version >= 2)
  if (version >= 2) {
    const positions = getAlignmentPositions(version);
    for (const row of positions) {
      for (const col of positions) {
        if (reserved[row]?.[col]) continue;
        placeAlignment(modules, reserved, row, col);
      }
    }
  }

  // Place timing patterns
  for (let i = 8; i < size - 8; i++) {
    const val = i % 2 === 0;
    if (!reserved[6]?.[i]) {
      setModule(modules, reserved, 6, i, val);
    }
    if (!reserved[i]?.[6]) {
      setModule(modules, reserved, i, 6, val);
    }
  }

  // Dark module
  setModule(modules, reserved, size - 8, 8, true);

  // Reserve format info areas
  for (let i = 0; i < 8; i++) {
    reserveOnly(reserved, 8, i);
    reserveOnly(reserved, 8, size - 1 - i);
    reserveOnly(reserved, i, 8);
    reserveOnly(reserved, size - 1 - i, 8);
  }
  reserveOnly(reserved, 8, 8);

  // Reserve version info areas (version >= 7)
  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        reserveOnly(reserved, i, size - 11 + j);
        reserveOnly(reserved, size - 11 + j, i);
      }
    }
  }

  // Encode data
  const encoded = encodeData(data, version);

  // Place data bits
  placeData(modules, reserved, encoded, size);

  // Apply best mask (simplified: use mask 0)
  applyMask(modules, reserved, size, 0);

  // Place format info
  placeFormatInfo(modules, size, 0);

  // Place version info
  if (version >= 7) {
    placeVersionInfo(modules, size, version);
  }

  return modules;
}

function selectVersion(dataLen: number): number {
  // Byte mode capacity at EC level L for versions 1-10
  const capacities = [17, 32, 53, 78, 106, 134, 154, 192, 230, 271];
  for (let v = 0; v < capacities.length; v++) {
    const cap = capacities[v];
    if (cap !== undefined && dataLen <= cap) return v + 1;
  }
  return 10; // fallback to max supported
}

function setModule(modules: boolean[][], reserved: boolean[][], row: number, col: number, val: boolean): void {
  const mRow = modules[row];
  const rRow = reserved[row];
  if (mRow && rRow) {
    mRow[col] = val;
    rRow[col] = true;
  }
}

function reserveOnly(reserved: boolean[][], row: number, col: number): void {
  const rRow = reserved[row];
  if (rRow) {
    rRow[col] = true;
  }
}

function placeFinder(modules: boolean[][], reserved: boolean[][], row: number, col: number): void {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const mr = row + r;
      const mc = col + c;
      if (mr < 0 || mc < 0 || mr >= modules.length || mc >= modules.length) continue;
      const isBlack =
        (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
        (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
        (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      setModule(modules, reserved, mr, mc, isBlack);
    }
  }
}

function placeAlignment(modules: boolean[][], reserved: boolean[][], row: number, col: number): void {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const isBlack = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
      setModule(modules, reserved, row + r, col + c, isBlack);
    }
  }
}

function getAlignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const intervals: number[][] = [
    [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
    [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
  ];
  return intervals[version - 1] ?? [6, 18];
}

function encodeData(data: Uint8Array, version: number): Uint8Array {
  // Total data codewords for version at EC level L
  const totalCodewords = getDataCodewords(version);

  const bits: number[] = [];

  // Mode indicator: byte mode = 0100
  bits.push(0, 1, 0, 0);

  // Character count indicator (8 bits for v1-9, 16 bits for v10+)
  const ccBits = version <= 9 ? 8 : 16;
  for (let i = ccBits - 1; i >= 0; i--) {
    bits.push((data.length >> i) & 1);
  }

  // Data bits
  for (const byte of data) {
    for (let i = 7; i >= 0; i--) {
      bits.push((byte >> i) & 1);
    }
  }

  // Terminator (up to 4 zeros)
  const maxBits = totalCodewords * 8;
  for (let i = 0; i < 4 && bits.length < maxBits; i++) {
    bits.push(0);
  }

  // Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  // Pad bytes
  const padBytes = [0xEC, 0x11];
  let padIdx = 0;
  while (bits.length < maxBits) {
    const pb = padBytes[padIdx % 2] ?? 0xEC;
    for (let i = 7; i >= 0; i--) {
      bits.push((pb >> i) & 1);
    }
    padIdx++;
  }

  // Convert to bytes
  const codewords = new Uint8Array(totalCodewords);
  for (let i = 0; i < totalCodewords; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | (bits[i * 8 + j] ?? 0);
    }
    codewords[i] = byte;
  }

  // Add error correction
  return addErrorCorrection(codewords, version);
}

function getDataCodewords(version: number): number {
  // Data codewords for EC level L
  const table = [19, 34, 55, 80, 108, 136, 156, 194, 232, 274];
  return table[version - 1] ?? 19;
}

function getTotalCodewords(version: number): number {
  const table = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
  return table[version - 1] ?? 26;
}

function getEcCodewordsPerBlock(version: number): number {
  const table = [7, 10, 15, 20, 26, 18, 20, 24, 30, 18];
  return table[version - 1] ?? 7;
}

function getNumBlocks(version: number): number {
  const table = [1, 1, 1, 1, 1, 2, 2, 2, 2, 4];
  return table[version - 1] ?? 1;
}

function addErrorCorrection(data: Uint8Array, version: number): Uint8Array {
  const totalCw = getTotalCodewords(version);
  const ecPerBlock = getEcCodewordsPerBlock(version);
  const numBlocks = getNumBlocks(version);
  const dataPerBlock = Math.floor(data.length / numBlocks);
  const remainder = data.length % numBlocks;

  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;

  for (let b = 0; b < numBlocks; b++) {
    const blockLen = dataPerBlock + (b >= numBlocks - remainder ? 1 : 0);
    const block = data.slice(offset, offset + blockLen);
    offset += blockLen;
    dataBlocks.push(block);
    ecBlocks.push(computeEcBytes(block, ecPerBlock));
  }

  // Interleave data blocks
  const result = new Uint8Array(totalCw);
  let idx = 0;
  const maxDataLen = Math.max(...dataBlocks.map(b => b.length));
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) {
        result[idx++] = block[i] ?? 0;
      }
    }
  }

  // Interleave EC blocks
  for (let i = 0; i < ecPerBlock; i++) {
    for (const block of ecBlocks) {
      if (i < block.length) {
        result[idx++] = block[i] ?? 0;
      }
    }
  }

  return result;
}

function computeEcBytes(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = getGeneratorPolynomial(ecCount);
  const result = new Uint8Array(ecCount);
  const msg = new Uint8Array(data.length + ecCount);
  msg.set(data);

  for (let i = 0; i < data.length; i++) {
    const coef = msg[i] ?? 0;
    if (coef !== 0) {
      const logCoef = GF_LOG[coef] ?? 0;
      for (let j = 0; j < gen.length; j++) {
        const genVal = gen[j] ?? 0;
        msg[i + j + 1] = (msg[i + j + 1] ?? 0) ^ (GF_EXP[(logCoef + genVal) % 255] ?? 0);
      }
    }
  }

  for (let i = 0; i < ecCount; i++) {
    result[i] = msg[data.length + i] ?? 0;
  }
  return result;
}

// GF(256) lookup tables
const GF_EXP = new Uint8Array(256);
const GF_LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11D : 0);
  }
  GF_EXP[255] = GF_EXP[0] ?? 1;
}

function getGeneratorPolynomial(degree: number): Uint8Array {
  let gen = new Uint8Array([0]);
  for (let i = 0; i < degree; i++) {
    const newGen = new Uint8Array(gen.length + 1);
    for (let j = 0; j < gen.length; j++) {
      newGen[j] = ((newGen[j] ?? 0) + (gen[j] ?? 0)) % 255 === 0
        ? (gen[j] ?? 0)
        : (gen[j] ?? 0);
      const sum = ((gen[j] ?? 0) + i) % 255;
      const existing = newGen[j + 1];
      newGen[j + 1] = existing === undefined ? sum : gfAdd(existing, sum);
    }
    gen = newGen;
  }
  return gen;
}

function gfAdd(a: number, b: number): number {
  if (a === 0) return b;
  if (b === 0) return a;
  return GF_LOG[(GF_EXP[a] ?? 0) ^ (GF_EXP[b] ?? 0)] ?? 0;
}

function placeData(modules: boolean[][], reserved: boolean[][], encoded: Uint8Array, size: number): void {
  let bitIdx = 0;
  let upward = true;

  for (let col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col = 5; // Skip timing column

    const rows = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const row of rows) {
      for (let c = 0; c < 2; c++) {
        const actualCol = col - c;
        if (actualCol < 0) continue;
        if (reserved[row]?.[actualCol]) continue;

        const bit = bitIdx < encoded.length * 8
          ? ((encoded[Math.floor(bitIdx / 8)] ?? 0) >> (7 - (bitIdx % 8))) & 1
          : 0;
        const mRow = modules[row];
        if (mRow) {
          mRow[actualCol] = bit === 1;
        }
        bitIdx++;
      }
    }
    upward = !upward;
  }
}

function applyMask(modules: boolean[][], reserved: boolean[][], size: number, mask: number): void {
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (reserved[row]?.[col]) continue;
      let invert = false;
      switch (mask) {
        case 0: invert = (row + col) % 2 === 0; break;
        case 1: invert = row % 2 === 0; break;
        case 2: invert = col % 3 === 0; break;
        case 3: invert = (row + col) % 3 === 0; break;
        case 4: invert = (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0; break;
        case 5: invert = ((row * col) % 2 + (row * col) % 3) === 0; break;
        case 6: invert = ((row * col) % 2 + (row * col) % 3) % 2 === 0; break;
        case 7: invert = ((row + col) % 2 + (row * col) % 3) % 2 === 0; break;
      }
      if (invert) {
        const mRow = modules[row];
        if (mRow) {
          mRow[col] = !mRow[col];
        }
      }
    }
  }
}

function placeFormatInfo(modules: boolean[][], size: number, mask: number): void {
  // EC level L = 01, mask pattern
  const formatInfo = FORMAT_INFO_STRINGS[mask] ?? FORMAT_INFO_STRINGS[0] ?? 0;

  // Place around top-left finder
  const bits: boolean[] = [];
  for (let i = 14; i >= 0; i--) {
    bits.push(((formatInfo >> i) & 1) === 1);
  }

  // Horizontal
  const hPositions = [0, 1, 2, 3, 4, 5, 7, 8, size - 8, size - 7, size - 6, size - 5, size - 4, size - 3, size - 2];
  for (let i = 0; i < 15; i++) {
    const col = hPositions[i] ?? 0;
    const mRow = modules[8];
    if (mRow) mRow[col] = bits[i] ?? false;
  }

  // Vertical
  const vPositions = [size - 1, size - 2, size - 3, size - 4, size - 5, size - 6, size - 7, size - 8, 7, 5, 4, 3, 2, 1, 0];
  for (let i = 0; i < 15; i++) {
    const row = vPositions[i] ?? 0;
    const mRow = modules[row];
    if (mRow) mRow[8] = bits[i] ?? false;
  }
}

// Pre-computed format info bit strings for EC level L, masks 0-7
const FORMAT_INFO_STRINGS = [
  0x77C4, 0x72F3, 0x7DAA, 0x789D, 0x662F, 0x6318, 0x6C41, 0x6976,
];

function placeVersionInfo(modules: boolean[][], size: number, version: number): void {
  if (version < 7) return;
  const info = VERSION_INFO[version - 7] ?? 0;
  for (let i = 0; i < 18; i++) {
    const bit = ((info >> i) & 1) === 1;
    const row = Math.floor(i / 3);
    const col = size - 11 + (i % 3);
    const mRow1 = modules[row];
    if (mRow1) mRow1[col] = bit;
    const mRow2 = modules[col];
    if (mRow2) mRow2[row] = bit;
  }
}

const VERSION_INFO = [
  0x07C94, 0x085BC, 0x09A99, 0x0A4D3,
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
