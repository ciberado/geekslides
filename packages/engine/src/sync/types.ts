/**
 * GeekSlides v2 — Sync type definitions.
 */

export interface SessionState {
  readonly slide: number;
  readonly partial: number;
  readonly mode: string;
  readonly presenterActive: boolean;
  readonly presenterId: string | null;
}

export interface WhiteboardStroke {
  readonly id: string;
  readonly slideIndex: number;
  readonly points: readonly [number, number][];
  readonly color: string;
  readonly width: number;
  readonly clientId: string;
  /** Canvas composite operation (default: 'source-over'). */
  readonly compositeOp?: GlobalCompositeOperation;
  /** Canvas globalAlpha (default: 1.0). */
  readonly alpha?: number;
}
