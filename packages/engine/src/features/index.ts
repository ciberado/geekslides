/**
 * GeekSlides v2 — Feature system public API.
 */

export { FeatureManager } from './FeatureManager.ts';
export { loadFeature } from './feature-loader.ts';
export { createQrOverlayFeature } from './qr-overlay-feature.ts';
export type {
  Feature,
  FeatureContext,
  FeatureLifecycleEvents,
  FeatureSlideshowAPI,
  FeatureCommandAPI,
  FeatureSyncAPI,
  FeatureOutputAPI,
} from './types.ts';
