// Seed capability data — the shared, curated source of per-model video params,
// ported from aihubmix-video's live /api/models/video catalogue (the production
// DB-backed list) and from open-design's gateway-verified probing.
//
// This is the "injected data" layer: consumers go through the registry
// (createCapabilityRegistry(AIHUBMIX_VIDEO_SEED)) so the eventual swap to a live
// AIHubMix /api/v1/models fetch is a local change. The catalogue API only
// returns id/label/type, so the per-model CONSTRAINTS (durations, sizes, i2v,
// family) live here and are the source of truth for both consumers' pickers.
//
// Keyed by upstream wire id (apiModel); the `aihubmix-` prefix is stripped by the
// registry. Combined t2v/i2v models carry `apiModelI2V`; vendors that expose the
// i2v variant as its own catalogue row also get a standalone entry so a direct
// lookup by either wire id resolves with full params.

import type { ModelCapability } from './contracts/types';

// Shared size lists (Alibaba Wan / Jimeng) — kept as consts to avoid drift.
const WAN_SIZES_BASE = [
  '1280x720', '720x1280', '960x960', '1088x832', '832x1088',
  '1920x1080', '1080x1920', '1440x1440', '1632x1248', '1248x1632',
];
const WAN25_SIZES = [...WAN_SIZES_BASE, '832x480', '480x832', '624x624'];
const JIMENG_SIZES = [
  '16:9', '9:16', '4:3', '3:4', '1:1', '21:9',
  '1920x1080', '1080x1920', '1664x1248', '1248x1664', '1440x1440', '2176x928',
];
const SEEDANCE_ASPECTS = ['16:9', '9:16', '4:3', '3:4', '21:9', '1:1'];

export const AIHUBMIX_VIDEO_SEED: ModelCapability[] = [
  // ── ByteDance SeeDance (火山 Ark) — multimodal content[] array ───────────
  {
    id: 'doubao-seedance-2-0-260128',
    apiModel: 'doubao-seedance-2-0-260128',
    label: 'SeeDance 2.0',
    vendorGroup: 'ByteDance',
    mediaType: 'video',
    family: 'seedance',
    caps: ['t2v', 'i2v'],
    supportedFrameImages: ['first_frame', 'reference_image'],
    supportedAspectRatios: SEEDANCE_ASPECTS,
    supportedResolutions: ['480p', '720p'],
    durationRange: { min: 4, max: 15 },
    generateAudio: true,
    seed: true,
    watermark: true,
    cameraFixed: true,
  },
  {
    id: 'doubao-seedance-2-0-fast-260128',
    apiModel: 'doubao-seedance-2-0-fast-260128',
    label: 'SeeDance 2.0 Fast',
    vendorGroup: 'ByteDance',
    mediaType: 'video',
    family: 'seedance',
    caps: ['t2v', 'i2v'],
    supportedFrameImages: ['first_frame', 'reference_image'],
    supportedAspectRatios: SEEDANCE_ASPECTS,
    supportedResolutions: ['480p', '720p'],
    durationRange: { min: 4, max: 15 },
    generateAudio: true,
    seed: true,
    watermark: true,
    cameraFixed: true,
  },

  // ── OpenAI Sora — generic flat shape with input_reference ────────────────
  {
    id: 'sora-2',
    apiModel: 'sora-2',
    label: 'Sora 2',
    vendorGroup: 'OpenAI',
    mediaType: 'video',
    family: 'generic',
    caps: ['t2v', 'i2v'],
    supportedFrameImages: ['first_frame'],
    supportedSizes: ['720x1280', '1280x720', '1024x1792', '1792x1024'],
    supportedDurations: [4, 8, 12],
    xSource: { from: 'avs://openai/official', authority: 'official' },
  },
  {
    id: 'sora-2-pro',
    apiModel: 'sora-2-pro',
    label: 'Sora 2 Pro',
    vendorGroup: 'OpenAI',
    mediaType: 'video',
    family: 'generic',
    caps: ['t2v', 'i2v'],
    supportedFrameImages: ['first_frame'],
    supportedSizes: ['720x1280', '1280x720', '1024x1792', '1792x1024'],
    supportedDurations: [4, 8, 12],
    xSource: { from: 'avs://openai/official', authority: 'official' },
  },

  // ── Alibaba Wan / 万相 — generic flat shape (gateway-normalised input_reference) ──
  // wan2.x i2v is normalised by the gateway to the flat OpenAI-style /videos body
  // (input_reference), NOT the DashScope input.media shape — that is happyhorse's.
  {
    id: 'wan2.6-t2v',
    apiModel: 'wan2.6-t2v',
    apiModelI2V: 'wan2.6-i2v',
    label: 'Wan 2.6',
    vendorGroup: 'Alibaba',
    mediaType: 'video',
    family: 'generic',
    caps: ['t2v', 'i2v'],
    supportedFrameImages: ['first_frame'],
    supportedSizes: WAN_SIZES_BASE,
    durationRange: { min: 2, max: 15 },
  },
  {
    id: 'wan2.6-i2v',
    apiModel: 'wan2.6-i2v',
    label: 'Wan 2.6 (I2V)',
    vendorGroup: 'Alibaba',
    mediaType: 'video',
    family: 'generic',
    caps: ['i2v'],
    supportedFrameImages: ['first_frame'],
    supportedSizes: WAN_SIZES_BASE,
    durationRange: { min: 2, max: 15 },
  },
  {
    id: 'wan2.5-t2v-preview',
    apiModel: 'wan2.5-t2v-preview',
    apiModelI2V: 'wan2.5-i2v-preview',
    label: 'Wan 2.5',
    vendorGroup: 'Alibaba',
    mediaType: 'video',
    family: 'generic',
    caps: ['t2v', 'i2v'],
    supportedFrameImages: ['first_frame'],
    supportedSizes: WAN25_SIZES,
    supportedDurations: [5, 10],
  },
  {
    id: 'wan2.5-i2v-preview',
    apiModel: 'wan2.5-i2v-preview',
    label: 'Wan 2.5 (I2V)',
    vendorGroup: 'Alibaba',
    mediaType: 'video',
    family: 'generic',
    caps: ['i2v'],
    supportedFrameImages: ['first_frame'],
    supportedSizes: WAN25_SIZES,
    supportedDurations: [5, 10],
  },

  // ── Jimeng AI (即梦) — generic flat shape; size list mixes ratio tokens + WxH ──
  {
    id: 'jimeng-3.0-pro',
    apiModel: 'jimeng-3.0-pro',
    label: 'Jimeng 3.0 Pro',
    vendorGroup: 'Jimeng AI',
    mediaType: 'video',
    family: 'generic',
    caps: ['t2v', 'i2v'],
    supportedFrameImages: ['first_frame'],
    supportedSizes: JIMENG_SIZES,
    supportedDurations: [5, 10],
  },
  {
    id: 'jimeng-3.0-1080p',
    apiModel: 'jimeng-3.0-1080p',
    label: 'Jimeng 3.0',
    vendorGroup: 'Jimeng AI',
    mediaType: 'video',
    family: 'generic',
    caps: ['t2v', 'i2v'],
    supportedFrameImages: ['first_frame'],
    supportedSizes: JIMENG_SIZES,
    supportedDurations: [5, 10],
  },

  // ── HappyHorse (Alibaba ATH, DashScope/wanx-backed) ──────────────────────
  // Verified wire shape: DashScope input.media + parameters (resolution UPPER
  // token, duration, prompt_extend, watermark). Now exposes both t2v and i2v.
  {
    id: 'happyhorse-1.0-t2v',
    apiModel: 'happyhorse-1.0-t2v',
    apiModelI2V: 'happyhorse-1.0-i2v',
    label: 'HappyHorse 1.0',
    vendorGroup: 'Alibaba',
    mediaType: 'video',
    family: 'dashscope',
    caps: ['t2v', 'i2v'],
    supportedFrameImages: ['first_frame'],
    supportedAspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    supportedResolutions: ['1080P', '720P'],
    durationRange: { min: 3, max: 15 },
  },
  {
    id: 'happyhorse-1.0-i2v',
    apiModel: 'happyhorse-1.0-i2v',
    label: 'HappyHorse 1.0 (I2V)',
    vendorGroup: 'Alibaba',
    mediaType: 'video',
    family: 'dashscope',
    caps: ['i2v'],
    supportedFrameImages: ['first_frame'],
    supportedAspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    supportedResolutions: ['1080P', '720P'],
    durationRange: { min: 3, max: 15 },
  },

  // ── Google Veo — own `veo` family (Gemini predictLongRunning shim) ───────
  // open-design gateway-verified; TEXT-TO-VIDEO ONLY (every reference form is
  // rejected by the shim). Not currently in aihubmix-video's catalogue but kept
  // for the open-design consumer. Flat body, seconds NUMBER, size only; 4/6/8s.
  {
    id: 'veo-3.1-generate-preview',
    apiModel: 'veo-3.1-generate-preview',
    label: 'Veo 3.1',
    vendorGroup: 'Google',
    mediaType: 'video',
    family: 'veo',
    caps: ['t2v'],
    supportedDurations: [4, 6, 8],
  },
  {
    id: 'veo-3.1-lite-generate-preview',
    apiModel: 'veo-3.1-lite-generate-preview',
    label: 'Veo 3.1 Lite',
    vendorGroup: 'Google',
    mediaType: 'video',
    family: 'veo',
    caps: ['t2v'],
    supportedDurations: [4, 6, 8],
  },
];
