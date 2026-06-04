// @aihubmix/media-adapters — public entrypoint.
//
// A pure, isomorphic interpreter that maps a unified media request to each
// vendor's NATIVE AIHubMix request shape. No transport (fetch/auth/poll/storage)
// and no proprietary model data baked in — capabilities are INJECTED.
//
// Today: video adapter is implemented (seedance / dashscope / veo / generic);
// image + audio contracts are defined (adapters land in a fast follow).

export * from './contracts/types';
export * from './contracts/video';
export * from './contracts/image';
export * from './contracts/audio';
export * from './capabilities';
export * from './adapters/video';
export { AIHUBMIX_VIDEO_SEED } from './seed';

import { createCapabilityRegistry } from './capabilities';
import { AIHUBMIX_VIDEO_SEED } from './seed';

/**
 * Default registry seeded with the bundled video models. Swap the seed for a
 * live AIHubMix /api/v1/models fetch (with this as a fallback) when available.
 */
export const aihubmixMediaRegistry = createCapabilityRegistry(AIHUBMIX_VIDEO_SEED);
