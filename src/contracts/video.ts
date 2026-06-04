// Video request/response contract — the unified input the adapter consumes and
// the transport-free result it produces. The caller resolves any reference
// image to a data URL BEFORE calling (the package performs no I/O), attaches
// auth + base URL after, and performs the fetch/poll/download itself.

import type { MediaFamily } from './types';

/**
 * Unified video request input. `passthrough` carries vendor-specific params;
 * only keys in the capability's `allowedPassthroughParameters` survive.
 */
export interface VideoBuildInput {
  prompt: string;
  durationSeconds?: number;
  aspectRatio?: string;
  size?: string;
  resolution?: string;
  /**
   * Seedance `ratio` alias. Seedance emits `ratio = ratio || aspectRatio`, so a
   * caller that distinguishes a true ratio param from an aspect hint can set
   * both; otherwise leave unset and `aspectRatio` is used.
   */
  ratio?: string;
  /** First-frame reference image as a data URL (data:image/...;base64,...). */
  imageRef?: { dataUrl: string };
  /** Additional reference images (seedance reference_image / extras). */
  extraImageRefs?: Array<{ dataUrl: string }>;
  /**
   * Pre-resolved seedance multimodal `content[]` (text + image_url/video_url,
   * each url already a data URL or public URL — the package does NO I/O). When
   * present, the seedance builder uses it verbatim instead of assembling content
   * from `imageRef`/`extraImageRefs`. This is how a rich caller (aihubmix-video)
   * passes first_frame/last_frame/reference_image/reference_video in one shot.
   */
  content?: Array<Record<string, unknown>>;
  generateAudio?: boolean;
  /** Seedance watermark toggle (emitted only when defined). */
  watermark?: boolean;
  /** Seedance camera_fixed toggle (emitted only when defined). */
  cameraFixed?: boolean;
  seed?: number;
  /** Vendor-specific params; filtered by allowedPassthroughParameters. */
  passthrough?: Record<string, unknown>;
}

/**
 * Result of building a request. Transport-free: the caller attaches auth + base
 * URL and POSTs `body` (JSON) to `${baseUrl}${pathSuffix}`.
 */
export interface BuiltVideoRequest {
  /** Resolved upstream model name actually sent (apiModel or apiModelI2V). */
  wireModel: string;
  family: MediaFamily;
  /** Path suffix to append to the provider base URL, e.g. `/videos`. */
  pathSuffix: string;
  contentType: string;
  body: Record<string, unknown>;
  /** Whether a reference image was attached (i2v). */
  hasReference: boolean;
}

/** Normalized submit/poll response shape across families. */
export interface NormalizedVideoResponse {
  id?: string;
  status?: string;
  /** Inline asset URL when the upstream returns one. */
  url?: string;
  error?: string;
}
