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

export async function createRoom(serverBaseUrl: string, room: string): Promise<ServerRoomTokens> {
  const res = await fetch(`${serverBaseUrl}/api/rooms/${encodeURIComponent(room)}/share`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`Failed to create room: ${String(res.status)} ${res.statusText}`);
  }
  return (await res.json()) as ServerRoomTokens;
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

  const res = await fetch(
    `${serverBaseUrl}/api/rooms/${encodeURIComponent(room)}/content`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to upload content: ${String(res.status)} ${res.statusText}`);
  }
  return (await res.json()) as ServerContentUploadResult;
}
