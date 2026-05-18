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

/**
 * Shared media playback state stored in the media-sync feature's Yjs map.
 * Keyed by slide index (string). Used by the media-sync Feature to sync
 * play/pause/seek across presenter and viewers.
 */
export interface MediaState {
  readonly playing: boolean;
  readonly currentTime: number;
  /** Wall-clock ms when this state was recorded (for drift correction). */
  readonly timestamp: number;
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
