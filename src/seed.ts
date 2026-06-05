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
// Wan sizes aligned to OpenRouter's videos/models size enums. wan-2.6 lists 4
// sizes; wan-2.7 lists 10 (adds square/4:3/portrait variants). wan2.2 keeps the
// full WAN_SIZES_BASE since OR has no wan-2.2 entry to tighten against.
const WAN_SIZES_OR = ['1280x720', '720x1280', '1920x1080', '1080x1920'];
const WAN27_SIZES_OR = [
  '1280x720', '720x1280', '1920x1080', '1080x1920', '720x720',
  '1080x1080', '960x720', '720x960', '1440x1080', '1080x1440',
];
const JIMENG_SIZES = [
  '16:9', '9:16', '4:3', '3:4', '1:1', '21:9',
  '1920x1080', '1080x1920', '1664x1248', '1248x1664', '1440x1440', '2176x928',
];
// Aligned to OpenRouter's seedance aspect enum (adds 9:21 vs the prior 6).
const SEEDANCE_ASPECTS = ['16:9', '9:16', '4:3', '3:4', '21:9', '1:1', '9:21'];

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
    supportedFrameImages: ['first_frame', 'last_frame', 'reference_image'],
    supportedAspectRatios: SEEDANCE_ASPECTS,
    supportedResolutions: ['480p', '720p', '1080p'],
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
    supportedFrameImages: ['first_frame', 'last_frame', 'reference_image'],
    supportedAspectRatios: SEEDANCE_ASPECTS,
    supportedResolutions: ['480p', '720p'],
    durationRange: { min: 4, max: 15 },
    generateAudio: true,
    seed: true,
    watermark: true,
    cameraFixed: true,
  },
  // SeeDance 1.x — i2v is FIRST-FRAME ONLY. Upstream maps reference_image→r2v,
  // which 1.x rejects ("task_type r2v does not support model …"); only 2.0 has r2v.
  // The CRITICAL constraint here is `supportedFrameImages: ['first_frame']` (no
  // reference_image). resolutions / durationRange / toggles are placeholders
  // copied from 2.0 — verify against each 1.x model's real limits.
  {
    id: 'doubao-seedance-1-0-pro-250528',
    apiModel: 'doubao-seedance-1-0-pro-250528',
    label: 'SeeDance 1.0 Pro',
    vendorGroup: 'ByteDance',
    mediaType: 'video',
    family: 'seedance',
    caps: ['t2v', 'i2v'],
    supportedFrameImages: ['first_frame'],
    supportedAspectRatios: SEEDANCE_ASPECTS,
    supportedResolutions: ['480p', '720p'],
    durationRange: { min: 4, max: 15 },
    generateAudio: true,
    seed: true,
    watermark: true,
    cameraFixed: true,
  },
  {
    id: 'doubao-seedance-1-0-pro-fast-251015',
    apiModel: 'doubao-seedance-1-0-pro-fast-251015',
    label: 'SeeDance 1.0 Pro Fast',
    vendorGroup: 'ByteDance',
    mediaType: 'video',
    family: 'seedance',
    caps: ['t2v', 'i2v'],
    supportedFrameImages: ['first_frame'],
    supportedAspectRatios: SEEDANCE_ASPECTS,
    supportedResolutions: ['480p', '720p'],
    durationRange: { min: 4, max: 15 },
    generateAudio: true,
    seed: true,
    watermark: true,
    cameraFixed: true,
  },
  {
    id: 'doubao-seedance-1-5-pro-251215',
    apiModel: 'doubao-seedance-1-5-pro-251215',
    label: 'SeeDance 1.5 Pro',
    vendorGroup: 'ByteDance',
    mediaType: 'video',
    family: 'seedance',
    caps: ['t2v', 'i2v'],
    supportedFrameImages: ['first_frame'],
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
    // AIHubMix gateway wants `seconds` as a string enum ('4'/'8'/'12').
    secondsFormat: 'string',
    // Sora i2v: input_reference must be an OBJECT ({ image_url }); string 400s.
    referenceAsObject: true,
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
    // OR marks sora-2-pro frame_images null; first_frame kept — OpenAI does
    // support an input_reference acting as the first frame (verified).
    supportedFrameImages: ['first_frame'],
    // sizes follow OpenAI's OFFICIAL sora-2-pro enum (gateway is pure passthrough,
    // so OpenAI is the real validator). NOTE: this DIVERGES from OR, which lists
    // 1080x1920/1920x1080 instead of the official 1024x1792/1792x1024.
    supportedResolutions: ['720p', '1024p', '1080p'],
    supportedAspectRatios: ['16:9', '9:16'],
    supportedSizes: ['720x1280', '1280x720', '1024x1792', '1792x1024'],
    supportedDurations: [4, 8, 12, 16, 20],
    generateAudio: true,
    // AIHubMix gateway wants `seconds` as a string enum ('4'/'8'/'12').
    secondsFormat: 'string',
    // Sora i2v: input_reference must be an OBJECT ({ image_url }); string 400s.
    referenceAsObject: true,
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
    supportedResolutions: ['480p', '720p', '1080p'],
    supportedAspectRatios: ['16:9', '9:16'],
    supportedSizes: WAN_SIZES_OR,
    // Official DashScope wan i2v accepts any integer 2–15s; the gateway is pure
    // passthrough (no clamp), so we follow OFFICIAL rather than OR's [5,10].
    durationRange: { min: 2, max: 15 },
    seed: true,
    generateAudio: true,
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
    supportedResolutions: ['480p', '720p', '1080p'],
    supportedAspectRatios: ['16:9', '9:16'],
    supportedSizes: WAN_SIZES_OR,
    // Official 2–15s; gateway passthrough → follow official (see wan2.6-t2v).
    durationRange: { min: 2, max: 15 },
    seed: true,
    generateAudio: true,
  },
  // wan2.7: t2v is generic (flat input_reference), but i2v is DashScope-native
  // (input.media + parameters) — family is left UNSET so deriveVideoFamily routes
  // each wire name correctly (wan2.7-t2v→generic, wan2.7-i2v→dashscope).
  {
    id: 'wan2.7-t2v',
    apiModel: 'wan2.7-t2v',
    apiModelI2V: 'wan2.7-i2v',
    label: 'Wan 2.7',
    vendorGroup: 'Alibaba',
    mediaType: 'video',
    caps: ['t2v', 'i2v'],
    supportedFrameImages: ['first_frame', 'last_frame'],
    supportedResolutions: ['480p', '720p', '1080p'],
    supportedAspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    supportedSizes: WAN27_SIZES_OR,
    // Official 2–15s; gateway passthrough → follow official (not OR's 2–10).
    durationRange: { min: 2, max: 15 },
    seed: true,
    generateAudio: true,
  },
  {
    id: 'wan2.7-i2v',
    apiModel: 'wan2.7-i2v',
    label: 'Wan 2.7 (I2V)',
    vendorGroup: 'Alibaba',
    mediaType: 'video',
    caps: ['i2v'],
    supportedFrameImages: ['first_frame', 'last_frame'],
    supportedResolutions: ['480p', '720p', '1080p'],
    supportedAspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    supportedSizes: WAN27_SIZES_OR,
    // Official 2–15s; gateway passthrough → follow official (not OR's 2–10).
    durationRange: { min: 2, max: 15 },
    seed: true,
    generateAudio: true,
  },
  {
    id: 'wan2.2-t2v-plus',
    apiModel: 'wan2.2-t2v-plus',
    apiModelI2V: 'wan2.2-i2v-plus',
    label: 'Wan 2.2 Plus',
    vendorGroup: 'Alibaba',
    mediaType: 'video',
    caps: ['t2v', 'i2v'],
    supportedFrameImages: ['first_frame'],
    supportedSizes: WAN_SIZES_BASE,
    durationRange: { min: 2, max: 15 },
  },
  {
    id: 'wan2.2-i2v-plus',
    apiModel: 'wan2.2-i2v-plus',
    label: 'Wan 2.2 Plus (I2V)',
    vendorGroup: 'Alibaba',
    mediaType: 'video',
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
  // Flat body, seconds NUMBER, size only; 4/6/8s. i2v is supported via a single
  // reference image: the gateway maps `input_reference` → Veo `referenceImages`
  // ({image, referenceType:'asset'}). This is an ASSET/style reference, NOT the
  // native `image`(first_frame)/`lastFrame`(last_frame) interpolation — the
  // gateway does not expose those — so the frame role is `reference_image`.
  {
    id: 'veo-3.1-generate-preview',
    apiModel: 'veo-3.1-generate-preview',
    label: 'Veo 3.1',
    vendorGroup: 'Google',
    mediaType: 'video',
    family: 'veo',
    caps: ['t2v', 'i2v'],
    supportedFrameImages: ['reference_image'],
    supportedResolutions: ['720p', '1080p', '4K'],
    supportedAspectRatios: ['16:9', '9:16'],
    supportedDurations: [4, 6, 8],
    seed: true,
    generateAudio: true,
  },
  {
    id: 'veo-3.1-lite-generate-preview',
    apiModel: 'veo-3.1-lite-generate-preview',
    label: 'Veo 3.1 Lite',
    vendorGroup: 'Google',
    mediaType: 'video',
    family: 'veo',
    caps: ['t2v', 'i2v'],
    supportedFrameImages: ['reference_image'],
    supportedResolutions: ['720p', '1080p'],
    supportedAspectRatios: ['16:9', '9:16'],
    supportedDurations: [4, 6, 8],
    seed: true,
    generateAudio: true,
  },
];
