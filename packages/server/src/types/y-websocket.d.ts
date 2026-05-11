declare module 'y-websocket/bin/utils' {
  import type { IncomingMessage } from 'http';
  import type { WebSocket } from 'ws';
  import type * as Y from 'yjs';

  interface SetupOptions {
    docName?: string;
    gc?: boolean;
  }

  export function setupWSConnection(
    conn: WebSocket,
    req: IncomingMessage,
    options?: SetupOptions,
  ): void;

  /** Map from room name → shared Y.Doc managed by y-websocket. */
  export const docs: Map<string, Y.Doc>;
}
