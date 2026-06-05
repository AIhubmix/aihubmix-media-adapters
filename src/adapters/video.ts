// Video request builder (layer ②) — pure, transport-free.
//
// Family branching (see MediaFamily in contracts/types):
//   • seedance  → JSON with a multimodal `content[]` array (text + image_url{url,role:first_frame});
//                 `duration` number, `resolution` token, optional `ratio`/`generate_audio`/`seed`.
//   • dashscope → Alibaba DashScope/wanx wire (happyhorse*):
//                 { model, input:{ prompt, media:[{type:first_frame,url}] },
//                   parameters:{ resolution(UPPER token), duration, prompt_extend, watermark } }.
//   • veo       → flat JSON { model, prompt, seconds(NUMBER), size }. The gateway's OpenAI→Gemini
//                 predictLongRunning shim wants an integer `seconds` and only `size` (no aspect_ratio);
//                 t2v-only (every reference form is rejected by the shim).
//   • generic   → flat JSON { model, prompt, seconds, size?, input_reference? } (sora / wan2.x / jimeng / …);
//                 `seconds` form (string|number) is injected via cap.secondsFormat; `aspect_ratio` never sent.
// seedance/generic keep injected-data-driven normalisation (snap helpers are a
// no-op on already-normalised inputs); happyhorse(dashscope)/wan/veo are verified
// and untouched. The caller resolves references to data/public URLs beforehand
// and attaches auth + base URL afterward; this module only shapes the body.

import type { MediaFamily, ModelCapability } from '../contracts/types';
import type {
  BuiltVideoRequest,
  NormalizedVideoResponse,
  VideoBuildInput,
} from '../contracts/video';

/** Resolve the upstream model name: i2v variant when a reference image is present. */
export function resolveWireModel(cap: ModelCapability, hasReference: boolean): string {
  return hasReference && cap.apiModelI2V ? cap.apiModelI2V : cap.apiModel;
}

/** Derive the request family from the resolved upstream model name (or explicit override). */
export function deriveVideoFamily(wireModel: string, cap?: ModelCapability): MediaFamily {
  if (cap?.family) return cap.family;
  const m = wireModel.toLowerCase();
  if (m.startsWith('doubao-seedance-')) return 'seedance';
  // happyhorse* (Alibaba ATH) is proxied to DashScope/wanx, which uses the
  // input.media + parameters wire shape (verified against a working
  // happyhorse-1.0-i2v call). wan2.x, by contrast, is normalised by the gateway
  // to the flat OpenAI-style /videos body (input_reference) — so wan* stays generic.
  if (m.startsWith('happyhorse')) return 'dashscope';
  // wan2.7 i2v is DashScope-native: it requires the input.media + parameters wire
  // shape (verified against a working wan2.7-i2v call), unlike the older wan2.x
  // i2v which the gateway normalises to the flat input_reference body. wan2.7 t2v
  // stays generic (verified working), so we key off the resolved i2v wire name.
  if (m.startsWith('wan2.7') && m.includes('i2v')) return 'dashscope';
  // veo* goes through the gateway's OpenAI→Gemini predictLongRunning shim, which
  // wants seconds as a NUMBER and only `size` (no aspect_ratio). Its own family.
  if (m.startsWith('veo')) return 'veo';
  return 'generic';
}

/**
 * Snap a requested duration to the model's declared constraint, in priority:
 *   1. `supportedDurations` (enum, e.g. Veo 4/6/8) → nearest; ties → shorter.
 *   2. else `durationRange` {min,max} (e.g. SeeDance 4–15) → clamp to range.
 *   3. else → built-in 3–12 clamp.
 * The constraint is INJECTED via the capability: a caller that declares its
 * model's real range (aihubmix-video) keeps in-range values verbatim (so this is
 * a no-op for already-validated inputs), while a caller that declares nothing
 * (open-design's synthesized cap) gets the safe default clamp.
 */
export function snapDuration(cap: ModelCapability, requested: number | undefined): number {
  const req = Number.isFinite(requested) ? (requested as number) : 5;
  const allowed = cap.supportedDurations;
  if (allowed && allowed.length > 0) {
    return allowed.reduce(
      (best, v) => (Math.abs(v - req) < Math.abs(best - req) ? v : best),
      allowed[0]!,
    );
  }
  if (cap.durationRange) {
    return Math.min(cap.durationRange.max, Math.max(cap.durationRange.min, Math.round(req)));
  }
  return Math.min(12, Math.max(3, Math.round(req)));
}

/**
 * Seedance and dashscope accept resolution ONLY as a quality token (`480p`/
 * `720p`/`1080p`), never a `WxH` pixel string. Callers may hand us either: an
 * explicit token from the tool's `resolution` arg, or a pixel `size` like
 * `1280x720` derived from an aspect ratio. Passing a pixel string straight
 * through makes Doubao Seedance 400 with "the parameter resolution ... is not
 * valid ... in i2v". Normalise to the nearest lowercase token by the short side
 * (720→720p, 1080→1080p, …); default to 720p when nothing usable is supplied.
 * (dashscope wants the uppercase form `720P`, so its branch upper-cases the result.)
 */
export function snapResolutionToken(
  resolution: string | undefined,
  size: string | undefined,
): string {
  const token = (resolution || '').trim().toLowerCase();
  if (/^(480|720|1080)p$/.test(token)) return token;
  const m = /^(\d+)\s*[x×]\s*(\d+)$/i.exec((size || resolution || '').trim());
  if (m) {
    const shortSide = Math.min(parseInt(m[1]!, 10), parseInt(m[2]!, 10));
    if (shortSide <= 480) return '480p';
    if (shortSide <= 720) return '720p';
    return '1080p';
  }
  return '720p';
}

/**
 * Veo (via the gateway's Gemini predictLongRunning shim) only accepts a handful
 * of `size` values — the gateway derives `resolution` from `size`, and anything
 * that maps outside 720p/1080p (e.g. a 1:1 `1024x1024`) 400s with "The string
 * value `1024p` for `resolution` is invalid". Snap whatever the caller hands us
 * to the nearest valid Veo size by orientation; default to landscape 720p.
 */
const VEO_VALID_SIZES = new Set(['1280x720', '720x1280', '1920x1080', '1080x1920']);
export function snapVeoSize(size: string | undefined): string {
  const s = (size || '').trim().toLowerCase().replace('×', 'x');
  if (VEO_VALID_SIZES.has(s)) return s;
  const m = /^(\d+)\s*x\s*(\d+)$/.exec(s);
  if (m) return parseInt(m[2]!, 10) > parseInt(m[1]!, 10) ? '720x1280' : '1280x720';
  return '1280x720';
}

/**
 * Snap a requested `size` to the model's declared `supportedSizes` by
 * orientation. Sora 400s on an unsupported size (e.g. a 1:1 `1024x1024`), so a
 * caller-derived size that isn't on the list is mapped to a supported one of the
 * same orientation. Returns the size unchanged when the model declares no
 * constraint; falls back to the first supported size when the input is
 * missing/unparseable.
 */
export function snapSizeToSupported(
  size: string | undefined,
  supported: string[] | undefined,
): string | undefined {
  if (!supported || supported.length === 0) return size;
  const norm = (v: string) => v.trim().toLowerCase().replace('×', 'x');
  const s = norm(size || '');
  const exact = supported.find((v) => norm(v) === s);
  if (exact) return exact;
  const dims = /^(\d+)\s*x\s*(\d+)$/.exec(s);
  const portrait = dims ? parseInt(dims[2]!, 10) > parseInt(dims[1]!, 10) : false;
  const match = supported.find((v) => {
    const m = /^(\d+)\s*x\s*(\d+)$/.exec(norm(v));
    return m ? parseInt(m[2]!, 10) > parseInt(m[1]!, 10) === portrait : false;
  });
  return match || supported[0];
}

/** Apply extraBodyDefaults, then overlay caller passthrough filtered by the whitelist. */
function mergeExtraBody(
  body: Record<string, unknown>,
  cap: ModelCapability,
  passthrough: Record<string, unknown> | undefined,
): void {
  for (const def of cap.extraBodyDefaults ?? []) {
    if (def.default !== undefined) body[def.name] = def.default;
  }
  if (passthrough && cap.allowedPassthroughParameters?.length) {
    const allow = new Set(cap.allowedPassthroughParameters);
    for (const [k, v] of Object.entries(passthrough)) {
      if (allow.has(k) && v !== undefined) body[k] = v;
    }
  }
}

/** Build the seedance multimodal content array (text + reference images). */
function buildSeedanceContent(input: VideoBuildInput): Array<Record<string, unknown>> {
  const content: Array<Record<string, unknown>> = [{ type: 'text', text: input.prompt }];
  if (input.imageRef?.dataUrl) {
    content.push({
      type: 'image_url',
      image_url: { url: input.imageRef.dataUrl },
      role: 'first_frame',
    });
  }
  if (input.lastFrameRef?.dataUrl) {
    content.push({
      type: 'image_url',
      image_url: { url: input.lastFrameRef.dataUrl },
      role: 'last_frame',
    });
  }
  for (const ref of input.extraImageRefs ?? []) {
    if (ref?.dataUrl) {
      content.push({
        type: 'image_url',
        image_url: { url: ref.dataUrl },
        role: 'reference_image',
      });
    }
  }
  return content;
}

/**
 * Build the upstream video request body for a model. Pure: no fetch, no auth.
 * Caller: POST `${baseUrl}${pathSuffix}` with auth headers + JSON.stringify(body).
 */
export function buildVideoRequest(cap: ModelCapability, input: VideoBuildInput): BuiltVideoRequest {
  const hasReference = Boolean(input.imageRef?.dataUrl);
  const wireModel = resolveWireModel(cap, hasReference);
  const family = deriveVideoFamily(wireModel, cap);
  const seconds = snapDuration(cap, input.durationSeconds);

  let body: Record<string, unknown>;
  if (family === 'seedance') {
    body = {
      model: wireModel,
      prompt: input.prompt,
      duration: seconds,
      // A rich caller (aihubmix-video) passes a pre-resolved content[] carrying
      // first_frame/last_frame/reference_image/reference_video; the narrow caller
      // (open-design chat) leaves it unset and we assemble from imageRef/extras.
      content: input.content ?? buildSeedanceContent(input),
    };
    // Seedance wants a resolution TOKEN (480p/720p/1080p), not a WxH pixel
    // string. Only emit when the caller supplied resolution or size (matching
    // aihubmix-video). `snapResolutionToken` is a no-op on an already-correct
    // token and converts an aspect-derived pixel `size` (open-design) to a token.
    if (input.resolution || input.size) {
      body.resolution = snapResolutionToken(input.resolution, input.size);
    }
    // Seedance `ratio` = ratio || aspect hint.
    const ratio = input.ratio || input.aspectRatio;
    if (ratio) body.ratio = ratio;
    if (typeof input.watermark === 'boolean') body.watermark = input.watermark;
    if (typeof input.seed === 'number') body.seed = input.seed;
    if (typeof input.cameraFixed === 'boolean') body.camera_fixed = input.cameraFixed;
    if (typeof input.generateAudio === 'boolean') body.generate_audio = input.generateAudio;
  } else if (family === 'dashscope') {
    // Alibaba DashScope/wanx wire (happyhorse*). The reference image is the
    // FIRST FRAME inside input.media; everything tunable lives under
    // `parameters`. Verified against a working happyhorse-1.0-i2v call.
    const dashInput: Record<string, unknown> = { prompt: input.prompt };
    const media: Array<Record<string, unknown>> = [];
    if (input.imageRef?.dataUrl) media.push({ type: 'first_frame', url: input.imageRef.dataUrl });
    if (input.lastFrameRef?.dataUrl) media.push({ type: 'last_frame', url: input.lastFrameRef.dataUrl });
    if (media.length) dashInput.media = media;
    const parameters: Record<string, unknown> = {
      resolution: snapResolutionToken(input.resolution, input.size).toUpperCase(),
      duration: seconds,
      prompt_extend: true,
      watermark: false,
    };
    if (input.aspectRatio) parameters.aspect_ratio = input.aspectRatio;
    if (typeof input.seed === 'number') parameters.seed = input.seed;
    body = { model: wireModel, input: dashInput, parameters };
  } else if (family === 'veo') {
    // Google Veo via the gateway's OpenAI→Gemini predictLongRunning shim. Unlike
    // the generic branch, `seconds` MUST be a number and `size` is the only size
    // hint it honours — sending the string "8" or an extra `aspect_ratio` makes
    // it fail. TEXT-TO-VIDEO ONLY: every reference-image form is rejected by the
    // shim end-to-end (the gateway's input_reference→referenceImages mapping is
    // not accepted by Veo), so we never attach one — callers gate i2v out via caps.
    body = {
      model: wireModel,
      prompt: input.prompt,
      seconds,
      // Always a valid Veo size — the gateway derives resolution from it, so a
      // 1:1/4:3 pixel string would 400 as an invalid resolution.
      size: snapVeoSize(input.size),
    };
    if (typeof input.generateAudio === 'boolean') body.generate_audio = input.generateAudio;
    if (typeof input.seed === 'number') body.seed = input.seed;
  } else {
    // Generic OpenAI-style /videos (sora / wan2.x / jimeng / …). The size hint is
    // `size` — NOT `aspect_ratio`, which Sora rejects with "Unknown parameter:
    // 'aspect_ratio'", so it is never forwarded (aihubmix-video's generic models
    // don't send one either). `seconds` form is injected via cap.secondsFormat
    // (Sora's enum is a string on some gateways; others take a number; default
    // number). Reference rides as input_reference.
    body = {
      model: wireModel,
      prompt: input.prompt,
      seconds: cap.secondsFormat === 'string' ? String(seconds) : seconds,
    };
    // Snap only when a size was supplied. No-op when it's already a declared
    // supported size (aihubmix-video); corrective for an aspect-derived pixel
    // size (open-design) that the model would 400 on.
    if (input.size) {
      const genericSize = snapSizeToSupported(input.size, cap.supportedSizes);
      if (genericSize) body.size = genericSize;
    }
    // The field name `dataUrl` carries the final input_reference value, which may
    // be a data URL or a public URL — the caller resolves it; we only place it.
    // Sora requires the OBJECT form `{ image_url }` (gateway/OpenAI 400s on a
    // string); wan2.x and other generic vendors accept the bare string. Driven by
    // the `referenceAsObject` capability flag, BUT also force-detected by wire
    // name: Sora's object requirement is an upstream hard fact, so it must hold
    // even when the caller injects its own capabilities without the flag set.
    const referenceAsObject = cap.referenceAsObject || /^sora/i.test(wireModel);
    if (hasReference) {
      body.input_reference = referenceAsObject
        ? { image_url: input.imageRef!.dataUrl }
        : input.imageRef!.dataUrl;
    }
  }

  mergeExtraBody(body, cap, input.passthrough);

  return {
    wireModel,
    family,
    pathSuffix: '/videos',
    contentType: 'application/json',
    body,
    hasReference,
  };
}

/** Best-effort normalization of an async-submit / poll response across families. */
export function normalizeVideoResponse(raw: unknown): NormalizedVideoResponse {
  const d = (raw ?? {}) as Record<string, any>;
  const id = d.id || d.task_id || d.data?.id || d.data?.task_id;
  const status = d.status || d.data?.status;
  const url =
    d.video_url
    || d.url
    || d.output_url
    || d.data?.video_url
    || d.data?.url
    || (Array.isArray(d.data) ? d.data[0]?.url : undefined)
    || (Array.isArray(d.unsigned_urls) ? d.unsigned_urls[0] : undefined);
  const error =
    d.error?.message || (typeof d.error === 'string' ? d.error : undefined) || d.failure_reason || d.message;
  return {
    ...(id ? { id: String(id) } : {}),
    ...(status ? { status: String(status) } : {}),
    ...(url ? { url: String(url) } : {}),
    ...(error ? { error: String(error) } : {}),
  };
}
