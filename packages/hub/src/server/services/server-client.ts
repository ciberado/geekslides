export interface ServerRoomTokens {
  readonly room: string;
  readonly presenterToken: string;
  readonly viewerToken: string;
}

export interface ServerContentUploadResult {
  readonly room: string;
  readonly files: string[];
  readonly totalSize: number;
}

export interface DeckFile {
  readonly path: string;
  readonly data: Buffer;
}

function getServerBaseUrlCandidates(serverBaseUrl: string): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];

  const add = (value: string): void => {
    const normalized = value.trim().replace(/\/+$/, '');
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  add(serverBaseUrl);

  try {
    const parsed = new URL(serverBaseUrl);
    const normalizedPath = parsed.pathname.replace(/\/+$/, '');

    // A common deployment mistake is setting SERVER_BASE_URL to .../hub.
    // Room/content APIs are rooted at /api, so also try the origin path.
    if (normalizedPath === '/hub') {
      const withoutHub = new URL(parsed.toString());
      withoutHub.pathname = '/';
      add(withoutHub.toString());
    }

    add(parsed.origin);
  } catch {
    // Keep original candidate only when URL parsing fails.
  }

  return candidates;
}

async function readErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 500);
  } catch {
    return '';
  }
}

export async function createRoom(serverBaseUrl: string, room: string): Promise<ServerRoomTokens> {
  let lastError: Error | null = null;

  for (const baseUrl of getServerBaseUrlCandidates(serverBaseUrl)) {
    const res = await fetch(`${baseUrl}/api/rooms/${encodeURIComponent(room)}/share`, {
      method: 'POST',
    });

    if (res.ok) {
      return (await res.json()) as ServerRoomTokens;
    }

    const body = await readErrorBody(res);
    const details = body ? ` - ${body}` : '';
    lastError = new Error(
      `Failed to create room via ${baseUrl}: ${String(res.status)} ${res.statusText}${details}`,
    );
  }

  throw lastError ?? new Error('Failed to create room');
}

export async function uploadContent(
  serverBaseUrl: string,
  room: string,
  files: readonly DeckFile[],
): Promise<ServerContentUploadResult> {
  const boundary = `----HubUpload${String(Date.now())}`;
  const parts: Buffer[] = [];

  for (const file of files) {
    const header =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="files"; filename="${file.path}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`;
    parts.push(Buffer.from(header));
    parts.push(file.data);
    parts.push(Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  let lastError: Error | null = null;

  for (const baseUrl of getServerBaseUrlCandidates(serverBaseUrl)) {
    const res = await fetch(
      `${baseUrl}/api/rooms/${encodeURIComponent(room)}/content`,
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body,
      },
    );

    if (res.ok) {
      return (await res.json()) as ServerContentUploadResult;
    }

    const bodyText = await readErrorBody(res);
    const details = bodyText ? ` - ${bodyText}` : '';
    lastError = new Error(
      `Failed to upload content via ${baseUrl}: ${String(res.status)} ${res.statusText}${details}`,
    );
  }

  throw lastError ?? new Error('Failed to upload content');
}
