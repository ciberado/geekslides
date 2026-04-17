/**
 * GeekSlides v2 — Multipart form-data parser.
 *
 * Parses multipart/form-data request bodies, extracting file fields
 * and an optional manifest JSON field. Extracted from ContentApi.ts
 * for independent testability.
 */

import type { IncomingMessage } from 'node:http';

export interface ParsedFile {
  readonly path: string;
  readonly data: Buffer;
}

export interface ParsedMultipart {
  readonly files: ParsedFile[];
  readonly manifest?: { files: string[] };
}

/**
 * Parse a multipart/form-data body and extract files.
 *
 * Expects fields named `files` with filename metadata.
 * Accepts an optional `manifest` JSON field.
 */
export async function parseMultipart(
  req: IncomingMessage,
  maxBodySize: number,
): Promise<ParsedMultipart> {
  const contentType = req.headers['content-type'] ?? '';
  const boundaryMatch = /boundary=([^\s;]+)/.exec(contentType);
  if (!boundaryMatch) {
    throw new Error('Missing multipart boundary');
  }

  const boundary = boundaryMatch[1] ?? '';
  const body = await readBody(req, maxBodySize);
  const parts = splitMultipartBody(body, boundary);

  const files: ParsedFile[] = [];
  let manifest: { files: string[] } | null = null;

  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      continue;
    }

    const headerBuf = part.subarray(0, headerEnd);
    const headers = headerBuf.toString('utf-8');
    const data = part.subarray(headerEnd + 4);

    const nameMatch = /name="([^"]*)"/.exec(headers);
    const filenameMatch = /filename="([^"]*)"/.exec(headers);

    if (nameMatch?.[1] === 'manifest' && !filenameMatch) {
      try {
        manifest = JSON.parse(data.toString('utf-8')) as { files: string[] };
      } catch {
        throw new Error('Invalid manifest JSON');
      }
      continue;
    }

    if (filenameMatch?.[1]) {
      files.push({ path: filenameMatch[1], data });
    }
  }

  return manifest ? { files, manifest } : { files };
}

export function readBody(req: IncomingMessage, maxSize: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalLength = 0;

    req.on('data', (chunk: Buffer) => {
      totalLength += chunk.length;
      if (totalLength > maxSize) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => { resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
}

export function splitMultipartBody(body: Buffer, boundary: string): Buffer[] {
  const delimiter = Buffer.from(`--${boundary}`);
  const parts: Buffer[] = [];

  let start = 0;
  for (;;) {
    const pos = body.indexOf(delimiter, start);
    if (pos === -1) {
      break;
    }

    if (start > 0) {
      // Trim trailing \r\n from previous part
      let end = pos;
      if (body[end - 1] === 0x0a && body[end - 2] === 0x0d) {
        end -= 2;
      }
      const part = body.subarray(start, end);
      if (part.length > 0) {
        parts.push(part);
      }
    }

    start = pos + delimiter.length;
    // Check for closing boundary --boundary--
    if (body[start] === 0x2d && body[start + 1] === 0x2d) {
      break;
    }
    // Skip \r\n after boundary
    if (body[start] === 0x0d && body[start + 1] === 0x0a) {
      start += 2;
    }
  }

  return parts;
}
