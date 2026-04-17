import { describe, it, expect } from 'vitest';
import { PassThrough } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { splitMultipartBody, readBody, parseMultipart } from '../src/multipart.ts';

/* ---------- helpers ---------------------------------------------------- */

function buildMultipartBody(
  boundary: string,
  parts: Array<{ name: string; filename?: string; data: string | Buffer }>,
): Buffer {
  const chunks: Buffer[] = [];
  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    if (part.filename !== undefined) {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n`));
    } else {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${part.name}"\r\n`));
    }
    chunks.push(Buffer.from('\r\n'));
    chunks.push(Buffer.isBuffer(part.data) ? part.data : Buffer.from(part.data));
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

function fakeRequest(body: Buffer, contentType: string): IncomingMessage {
  const stream = new PassThrough() as unknown as IncomingMessage;
  stream.headers = { 'content-type': contentType };
  process.nextTick(() => {
    (stream as unknown as PassThrough).end(body);
  });
  return stream;
}

/* ---------- splitMultipartBody ----------------------------------------- */

describe('splitMultipartBody', () => {
  it('splits a body with multiple parts', () => {
    const boundary = 'testboundary';
    const body = buildMultipartBody(boundary, [
      { name: 'a', filename: 'a.txt', data: 'hello' },
      { name: 'b', filename: 'b.txt', data: 'world' },
    ]);

    const parts = splitMultipartBody(body, boundary);

    expect(parts).toHaveLength(2);
    expect(parts[0]?.toString()).toContain('hello');
    expect(parts[1]?.toString()).toContain('world');
  });

  it('returns empty array for empty body', () => {
    const boundary = 'empty';
    const body = Buffer.from(`--${boundary}--\r\n`);

    const parts = splitMultipartBody(body, boundary);

    expect(parts).toHaveLength(0);
  });

  it('handles single part', () => {
    const boundary = 'single';
    const body = buildMultipartBody(boundary, [
      { name: 'only', filename: 'only.txt', data: 'content' },
    ]);

    const parts = splitMultipartBody(body, boundary);

    expect(parts).toHaveLength(1);
    expect(parts[0]?.toString()).toContain('content');
  });
});

/* ---------- readBody --------------------------------------------------- */

describe('readBody', () => {
  it('reads full request body', async () => {
    const data = Buffer.from('test body content');
    const stream = new PassThrough() as unknown as IncomingMessage;
    process.nextTick(() => {
      (stream as unknown as PassThrough).end(data);
    });

    const result = await readBody(stream, 1024);

    expect(result.toString()).toBe('test body content');
  });

  it('rejects when body exceeds maxSize', async () => {
    const stream = new PassThrough() as unknown as IncomingMessage;
    // Override destroy to prevent unhandled errors
    stream.destroy = (() => stream) as unknown as typeof stream.destroy;
    process.nextTick(() => {
      (stream as unknown as PassThrough).write(Buffer.alloc(200));
      (stream as unknown as PassThrough).end();
    });

    await expect(readBody(stream, 100)).rejects.toThrow('Request body too large');
  });
});

/* ---------- parseMultipart --------------------------------------------- */

describe('parseMultipart', () => {
  const boundary = 'parseboundary';

  it('extracts files from multipart body', async () => {
    const body = buildMultipartBody(boundary, [
      { name: 'files', filename: 'readme.md', data: '# Hello' },
      { name: 'files', filename: 'style.css', data: 'body {}' },
    ]);

    const req = fakeRequest(body, `multipart/form-data; boundary=${boundary}`);
    const result = await parseMultipart(req, 10 * 1024 * 1024);

    expect(result.files).toHaveLength(2);
    expect(result.files[0]?.path).toBe('readme.md');
    expect(result.files[0]?.data.toString()).toBe('# Hello');
    expect(result.files[1]?.path).toBe('style.css');
    expect(result.manifest).toBeUndefined();
  });

  it('extracts manifest JSON field', async () => {
    const manifest = JSON.stringify({ files: ['a.md', 'b.css'] });
    const body = buildMultipartBody(boundary, [
      { name: 'manifest', data: manifest },
      { name: 'files', filename: 'a.md', data: 'content' },
    ]);

    const req = fakeRequest(body, `multipart/form-data; boundary=${boundary}`);
    const result = await parseMultipart(req, 10 * 1024 * 1024);

    expect(result.files).toHaveLength(1);
    expect(result.manifest).toEqual({ files: ['a.md', 'b.css'] });
  });

  it('throws on missing boundary', async () => {
    const body = Buffer.from('anything');
    const req = fakeRequest(body, 'multipart/form-data');

    await expect(parseMultipart(req, 10 * 1024 * 1024)).rejects.toThrow('Missing multipart boundary');
  });

  it('throws on invalid manifest JSON', async () => {
    const body = buildMultipartBody(boundary, [
      { name: 'manifest', data: 'not json' },
    ]);

    const req = fakeRequest(body, `multipart/form-data; boundary=${boundary}`);

    await expect(parseMultipart(req, 10 * 1024 * 1024)).rejects.toThrow('Invalid manifest JSON');
  });

  it('handles binary file data', async () => {
    const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG header
    const body = buildMultipartBody(boundary, [
      { name: 'files', filename: 'image.png', data: binaryData },
    ]);

    const req = fakeRequest(body, `multipart/form-data; boundary=${boundary}`);
    const result = await parseMultipart(req, 10 * 1024 * 1024);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.path).toBe('image.png');
    expect(result.files[0]?.data[0]).toBe(0x89);
  });
});
