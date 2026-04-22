/**
 * GeekSlides v2 — Feature system public API.
 */

export { FeatureManager } from './FeatureManager.ts';
export { loadFeature } from './feature-loader.ts';
export type {
  Feature,
  FeatureContext,
  FeatureLifecycleEvents,
  FeatureSlideshowAPI,
  FeatureCommandAPI,
  FeatureSyncAPI,
  FeatureOutputAPI,
} from './types.ts';
