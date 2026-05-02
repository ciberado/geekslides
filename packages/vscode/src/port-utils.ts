import { createServer } from 'node:net';

async function probePort(port: number, host: string): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer();

    server.once('error', (error: NodeJS.ErrnoException) => {
      server.close();
      reject(error);
    });

    server.once('listening', () => {
      const address = server.address();
      const resolvedPort = typeof address === 'object' && address ? address.port : port;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(resolvedPort);
      });
    });

    server.listen(port, host);
  });
}

export async function pickAvailablePort(
  preferredPort: number,
  host: string = '127.0.0.1',
): Promise<number> {
  try {
    await probePort(preferredPort, host);
    return preferredPort;
  } catch (error) {
    const cause = error as NodeJS.ErrnoException;
    if (cause.code !== 'EADDRINUSE') {
      throw error;
    }
  }

  return await probePort(0, host);
}
