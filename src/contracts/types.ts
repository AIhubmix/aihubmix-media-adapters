// Shared capability contract (layer ①) — pure, isomorphic, transport-free.
//
// Field naming/conventions mirror AIHubMix's contract.json (OpenAPI-style enum/
// range + x-source provenance) and OpenRouter's GET /api/v1/videos/models, so a
// future swap to a remote data source (/api/v1/models + contract.json) is a
// data-source change, not a reshape. This package bakes in NO proprietary model
// data — capabilities are INJECTED via createCapabilityRegistry(seed).

export type MediaType = 'video' | 'image' | 'audio';

/**
 * Request-shape family for the passthrough interpreter. Resolved from the
 * upstream model name (see deriveVideoFamily) or set explicitly on a capability.
 *
 *   • `seedance`  — ByteDance Ark; multimodal `content[]` array
 *                   (text + image_url{url,role:first_frame}); `duration` number, `resolution` token.
 *   • `dashscope` — Alibaba DashScope/wanx async wire:
 *                   { input:{ prompt, media:[{type:first_frame,url}] }, parameters:{ resolution(UPPER), duration, … } }.
 *                   Used by happyhorse* (Alibaba ATH). Verified against a working happyhorse-1.0-i2v call.
 *   • `veo`       — Google Veo via the gateway's Gemini predictLongRunning shim;
 *                   flat body, `seconds` as a NUMBER, `size` only (no aspect_ratio/resolution); t2v-only.
 *   • `generic`   — flat OpenAI-style `{ model, prompt, seconds(string), size?, input_reference? }`
 *                   (sora / wan2.x / jimeng / …). Reference rides as an inline data-URL `input_reference`.
 */
export type MediaFamily = 'seedance' | 'dashscope' | 'veo' | 'generic';

/** Vendor-specific param passthrough declaration. */
export interface ExtraBodyParamDef {
  name: string;
  type: 'string' | 'number' | 'boolean';
  default?: string | number | boolean;
  description?: string;
}

/** Provenance of a capability/field, aligned with contract.json's `x-source`. Informational. */
export interface CapabilitySource {
  /** e.g. "avs://openai/official" */
  from?: string;
  /** e.g. "official" | "community" */
  authority?: string;
}

/**
 * Per-model capability *description*. Fields aligned with OpenRouter's
 * videos/models + AIHubMix contract.json so the eventual remote source is a
 * drop-in. `id` is the catalogue id (the consumer strips any `aihubmix-` prefix
 * on lookup via the registry).
 */
export interface ModelCapability {
  /** Catalogue id, e.g. `doubao-seedance-2-0-260128` (NO `aihubmix-` prefix). */
  id: string;
  /** Upstream model name for text-to-video / base. */
  apiModel: string;
  /** Upstream model name used when a reference image is present (image-to-video). */
  apiModelI2V?: string;
  mediaType: MediaType;
  /** Human-readable display label for model pickers (else derive from id). */
  label?: string;
  /** UI grouping by vendor, e.g. 'ByteDance' / 'Alibaba' / 'OpenAI'. Informational. */
  vendorGroup?: string;
  /** Capability tags: t2v / i2v / r2v / t2i / i2i / edit / tts ... */
  caps: string[];
  /** Explicit family override; when omitted it is derived from the resolved upstream model name. */
  family?: MediaFamily;
  /** Per-model base URL override (else the caller's default AIHubMix base). */
  baseUrl?: string;

  // ── OpenRouter / contract.json-aligned constraint declaration ─────────────
  supportedDurations?: number[];
  /**
   * Continuous duration range (when the model accepts any integer in [min,max]
   * rather than a fixed enum). `snapDuration` clamps to this before its built-in
   * 3–12 default — so SeeDance's {min:4,max:15} keeps a 15s request at 15
   * instead of clamping to 12. Ignored when `supportedDurations` (enum) is set.
   */
  durationRange?: { min: number; max: number };
  supportedSizes?: string[];
  supportedAspectRatios?: string[];
  supportedResolutions?: string[];
  /** Reference-frame roles accepted, e.g. ['first_frame']. Empty/absent ⇒ no i2v. */
  supportedFrameImages?: string[];
  generateAudio?: boolean;
  seed?: boolean;
  /** Model supports a watermark toggle (seedance). UI/declaration metadata. */
  watermark?: boolean;
  /** Model supports a camera_fixed toggle (seedance). UI/declaration metadata. */
  cameraFixed?: boolean;
  /**
   * Wire form of `seconds` for the `generic` family ONLY. Sora's enum is a
   * string ("4"/"8"/"12") on some gateways; other generic vendors take a number.
   * Defaults to `'number'`. (veo always emits a number; seedance/dashscope use
   * their own `duration` field, so this flag is a no-op for them.)
   */
  secondsFormat?: 'string' | 'number';

  /** Whitelist of vendor-specific params the caller may pass through. */
  allowedPassthroughParameters?: string[];
  /** Defaults for vendor-specific params merged into the request body. */
  extraBodyDefaults?: ExtraBodyParamDef[];

  /** Optional provenance (contract.json `x-source` style). Informational only. */
  xSource?: CapabilitySource;
}
