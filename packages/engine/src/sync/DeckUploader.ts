/**
 * GeekSlides v2 — Deck asset scanner and uploader.
 *
 * Scans markdown, CSS, and config for local asset references,
 * then uploads them to the server content proxy.
 */

/** Relative file paths referenced by the deck. */
export interface DeckManifest {
  readonly configPath: string;
  readonly contentPath: string;
  readonly stylePaths: readonly string[];
  readonly imagePaths: readonly string[];
}

/**
 * Scan markdown content for image references.
 * Matches: ![alt](path), bgurl(path), and HTML <img src="path">.
 * Skips absolute URLs (http://, https://, //).
 */
export function scanMarkdownImages(markdown: string): string[] {
  const images = new Set<string>();

  // ![alt](path) — standard markdown images
  const mdImageRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = mdImageRegex.exec(markdown)) !== null) {
    const src = match[1]?.trim();
    if (src && !isAbsoluteUrl(src)) {
      images.add(src);
    }
  }

  // bgurl(path) — GeekSlides background image syntax
  const bgurlRegex = /bgurl\(([^)]+)\)/gi;
  while ((match = bgurlRegex.exec(markdown)) !== null) {
    const src = match[1]?.trim();
    if (src && !isAbsoluteUrl(src)) {
      images.add(src);
    }
  }

  // <img src="path"> — inline HTML images
  const imgTagRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  while ((match = imgTagRegex.exec(markdown)) !== null) {
    const src = match[1]?.trim();
    if (src && !isAbsoluteUrl(src)) {
      images.add(src);
    }
  }

  return [...images];
}

/**
 * Scan CSS content for url() references.
 * Skips absolute URLs and data: URIs.
 */
export function scanCssUrls(css: string): string[] {
  const urls = new Set<string>();

  const urlRegex = /url\(\s*["']?([^"')]+)["']?\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(css)) !== null) {
    const src = match[1]?.trim();
    if (src && !isAbsoluteUrl(src) && !src.startsWith('data:')) {
      urls.add(src);
    }
  }

  return [...urls];
}

function isAbsoluteUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//');
}

export interface DeckConfig {
  readonly content: string;
  readonly styles?: readonly string[];
}

/**
 * Build a manifest of all files the deck references.
 */
export function buildManifest(
  configPath: string,
  config: DeckConfig,
  markdown: string,
  css: string,
): DeckManifest {
  const stylePaths = config.styles ? [...config.styles] : [];
  const markdownImages = scanMarkdownImages(markdown);
  const cssImages = scanCssUrls(css);

  const allImages = [...new Set([...markdownImages, ...cssImages])];

  return {
    configPath: basename(configPath),
    contentPath: config.content,
    stylePaths,
    imagePaths: allImages,
  };
}

function basename(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash >= 0 ? path.substring(lastSlash + 1) : path;
}

/**
 * Upload deck assets to the server content proxy.
 *
 * Fetches each referenced file relative to configBase, then POSTs
 * them as multipart/form-data to /api/rooms/:room/content.
 */
export async function uploadDeck(
  serverBaseUrl: string,
  room: string,
  configBase: string,
  manifest: DeckManifest,
  fetchFn: typeof fetch = fetch,
): Promise<{ files: string[]; totalSize: number }> {
  const filesToUpload: Array<{ path: string; data: ArrayBuffer }> = [];

  const allPaths = [
    manifest.configPath,
    manifest.contentPath,
    ...manifest.stylePaths,
    ...manifest.imagePaths,
  ];

  // Deduplicate
  const uniquePaths = [...new Set(allPaths)];

  for (const relativePath of uniquePaths) {
    const url = configBase + relativePath;
    try {
      const res = await fetchFn(url);
      if (res.ok) {
        const data = await res.arrayBuffer();
        filesToUpload.push({ path: relativePath, data });
      } else {
        console.warn(`[content-proxy] Skipping ${relativePath}: ${String(res.status)}`);
      }
    } catch (err) {
      console.warn(`[content-proxy] Failed to fetch ${relativePath}:`, err);
    }
  }

  if (filesToUpload.length === 0) {
    throw new Error('No deck files could be fetched for upload');
  }

  // Build multipart/form-data body
  const boundary = `----GeekSlides${String(Date.now())}${String(Math.random()).slice(2, 8)}`;
  const parts: Uint8Array[] = [];
  const encoder = new TextEncoder();

  for (const file of filesToUpload) {
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${file.path}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
    parts.push(encoder.encode(header));
    parts.push(new Uint8Array(file.data));
    parts.push(encoder.encode('\r\n'));
  }

  parts.push(encoder.encode(`--${boundary}--\r\n`));

  // Concatenate all parts
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const body = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    body.set(part, offset);
    offset += part.length;
  }

  const uploadUrl = `${serverBaseUrl}/api/rooms/${encodeURIComponent(room)}/content`;
  const res = await fetchFn(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  } as RequestInit);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${String(res.status)} ${text}`);
  }

  return (await res.json()) as { files: string[]; totalSize: number };
}

/**
 * Get the proxy base URL for a room's content.
 */
export function getProxyBaseUrl(serverBaseUrl: string, room: string): string {
  return `${serverBaseUrl}/api/rooms/${encodeURIComponent(room)}/content/`;
}
