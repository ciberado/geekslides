declare module 'y-websocket/bin/utils' {
  import type { IncomingMessage } from 'http';
  import type { WebSocket } from 'ws';

  interface SetupOptions {
    docName?: string;
    gc?: boolean;
  }

  export function setupWSConnection(
    conn: WebSocket,
    req: IncomingMessage,
    options?: SetupOptions,
  ): void;
}
