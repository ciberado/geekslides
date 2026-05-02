import { createServer } from 'node:net';
import { describe, expect, it } from 'vitest';
import { pickAvailablePort } from '../src/port-utils.ts';

describe('pickAvailablePort', () => {
  it('returns the preferred port when it is free', async () => {
    const freeServer = createServer();

    const preferredPort = await new Promise<number>((resolve, reject) => {
      freeServer.once('error', reject);
      freeServer.listen(0, '127.0.0.1', () => {
        const address = freeServer.address();
        if (!address || typeof address !== 'object') {
          reject(new Error('Expected free server to expose a numeric port'));
          return;
        }
        resolve(address.port);
      });
    });

    await new Promise<void>((resolve, reject) => {
      freeServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    const port = await pickAvailablePort(preferredPort);
    expect(port).toBe(preferredPort);
  });

  it('falls back to another port when the preferred port is busy', async () => {
    const busyServer = createServer();

    await new Promise<void>((resolve, reject) => {
      busyServer.once('error', reject);
      busyServer.listen(0, '127.0.0.1', () => resolve());
    });

    try {
      const address = busyServer.address();
      if (!address || typeof address !== 'object') {
        throw new Error('Expected busy server to expose a numeric port');
      }

      const picked = await pickAvailablePort(address.port);
      expect(picked).not.toBe(address.port);
      expect(picked).toBeGreaterThan(0);
    } finally {
      await new Promise<void>((resolve, reject) => {
        busyServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  });
});
