// Parity: @aihubmix/media-adapters ⟷ aihubmix-video `lib/server/video/create-task.ts`
//
// Proves the package, fed aihubmix-video's MODEL_CONFIGS (mapped to a capability)
// and a normalized request, produces the SAME upstream `body` that the current
// create-task.ts hand-builds — i.e. swapping create-task to the package is a
// ZERO wire-change refactor.
//
// Scope is BODY SHAPING only. create-task keeps its own I/O (reference fetch /
// upload load / SSRF / base64 and seedance content assembly); here we feed the
// already-resolved values (data URLs, pre-built content[]) exactly as the
// rewritten create-task will hand them to the package.
//
// `mapConfigToCapability` + `buildBody` below mirror, line-for-line, the logic
// that lands in create-task.ts.

import { describe, expect, it } from 'vitest';
import { buildVideoRequest, deriveVideoFamily, type ModelCapability } from '../src/index';

// ── Minimal MODEL_CONFIGS slices (fields the mapper reads), copied verbatim ──
type Cfg = {
  key: string;
  apiModel: string;
  apiModelI2V?: string;
  baseUrl?: string;
  params: {
    seconds?: number[] | { min: number; max: number; default: number };
    size?: string[];
    supportsInputReference: boolean;
  };
};

const CONFIGS: Record<string, Cfg> = {
  'seedance-2.0': {
    key: 'seedance-2.0',
    apiModel: 'doubao-seedance-2-0-260128',
    params: { seconds: { min: 4, max: 15, default: 5 }, size: ['480p', '720p'], supportsInputReference: true },
  },
  'sora-2': {
    key: 'sora-2',
    apiModel: 'sora-2',
    params: { seconds: [4, 8, 12], size: ['720x1280', '1280x720', '1024x1792', '1792x1024'], supportsInputReference: true },
  },
  'wan2.5': {
    key: 'wan2.5',
    apiModel: 'wan2.5-t2v-preview',
    apiModelI2V: 'wan2.5-i2v-preview',
    params: {
      seconds: [5, 10],
      size: ['1280x720', '720x1280', '960x960', '1088x832', '832x1088', '1920x1080', '1080x1920'],
      supportsInputReference: true,
    },
  },
  'jimeng-3.0-pro': {
    key: 'jimeng-3.0-pro',
    apiModel: 'jimeng-3.0-pro',
    params: {
      seconds: [5, 10],
      size: ['16:9', '9:16', '4:3', '3:4', '1:1', '21:9', '1920x1080', '1080x1920'],
      supportsInputReference: true,
    },
  },
};

// ── The mapper that will live in create-task.ts ──────────────────────────────
function mapConfigToCapability(mc: Cfg): ModelCapability {
  const sec = mc.params.seconds;
  const supportedDurations = Array.isArray(sec) ? sec : undefined;
  const durationRange = sec && !Array.isArray(sec) ? { min: sec.min, max: sec.max } : undefined;
  const isGeneric =
    !mc.apiModel.startsWith('doubao-seedance-') &&
    !mc.apiModel.startsWith('happyhorse') &&
    !mc.apiModel.startsWith('veo');
  return {
    id: mc.key,
    apiModel: mc.apiModel,
    ...(mc.apiModelI2V ? { apiModelI2V: mc.apiModelI2V } : {}),
    mediaType: 'video',
    caps: ['t2v', ...(mc.params.supportsInputReference ? ['i2v'] : [])],
    ...(supportedDurations ? { supportedDurations } : {}),
    ...(durationRange ? { durationRange } : {}),
    ...(mc.params.size ? { supportedSizes: mc.params.size } : {}),
    ...(isGeneric ? { secondsFormat: 'number' as const } : {}),
    ...(mc.baseUrl ? { baseUrl: mc.baseUrl } : {}),
  };
}

// ── The body-shaping delegation that will live in create-task.ts ─────────────
type Req = {
  prompt: string;
  seconds: number;
  size?: string;
  resolution?: string;
  ratio?: string;
  aspect_ratio?: string;
  watermark?: boolean;
  seed?: number;
  camera_fixed?: boolean;
  generate_audio?: boolean;
  content?: Array<Record<string, unknown>>; // seedance: pre-resolved
  finalReference?: string; // generic: already-resolved input_reference
  extraBody?: Record<string, unknown>;
};

function buildBody(mc: Cfg, req: Req): Record<string, unknown> {
  const cap = mapConfigToCapability(mc);
  const isSeedance = mc.apiModel.startsWith('doubao-seedance-');
  const built = isSeedance
    ? buildVideoRequest(cap, {
        prompt: req.prompt,
        durationSeconds: req.seconds,
        resolution: req.resolution,
        size: req.size,
        ratio: req.ratio,
        aspectRatio: req.aspect_ratio,
        watermark: req.watermark,
        seed: req.seed,
        cameraFixed: req.camera_fixed,
        generateAudio: req.generate_audio,
        content: req.content,
      })
    : buildVideoRequest(cap, {
        prompt: req.prompt,
        durationSeconds: req.seconds,
        aspectRatio: req.aspect_ratio,
        size: req.size,
        imageRef: req.finalReference ? { dataUrl: req.finalReference } : undefined,
      });
  Object.assign(built.body, req.extraBody ?? {});
  return built.body;
}

const DATA = 'data:image/png;base64,aGVsbG8=';

describe('parity — aihubmix-video create-task body shapes', () => {
  it('family routing matches create-task is*Model checks', () => {
    expect(deriveVideoFamily('doubao-seedance-2-0-260128')).toBe('seedance');
    expect(deriveVideoFamily('sora-2')).toBe('generic');
    expect(deriveVideoFamily('wan2.5-i2v-preview')).toBe('generic');
    expect(deriveVideoFamily('jimeng-3.0-pro')).toBe('generic');
  });

  it('seedance i2v (content + token size + seed + audio)', () => {
    const content = [
      { type: 'text', text: 'a panda' },
      { type: 'image_url', image_url: { url: DATA }, role: 'first_frame' },
    ];
    const body = buildBody(CONFIGS['seedance-2.0']!, {
      prompt: 'a panda',
      seconds: 5,
      size: '720p',
      generate_audio: true,
      seed: 7,
      content,
    });
    expect(body).toEqual({
      model: 'doubao-seedance-2-0-260128',
      prompt: 'a panda',
      duration: 5,
      content,
      resolution: '720p', // resolution || size, token unchanged
      seed: 7,
      generate_audio: true,
    });
  });

  it('seedance t2v (ratio + watermark + camera_fixed)', () => {
    const content = [{ type: 'text', text: 'sun' }];
    const body = buildBody(CONFIGS['seedance-2.0']!, {
      prompt: 'sun',
      seconds: 8,
      resolution: '720p',
      ratio: '16:9',
      watermark: false,
      camera_fixed: true,
      content,
    });
    expect(body).toEqual({
      model: 'doubao-seedance-2-0-260128',
      prompt: 'sun',
      duration: 8,
      content,
      resolution: '720p',
      ratio: '16:9',
      watermark: false,
      camera_fixed: true,
    });
  });

  it('seedance keeps 15s (durationRange 4–15, not clamped to 12)', () => {
    const body = buildBody(CONFIGS['seedance-2.0']!, {
      prompt: 'x',
      seconds: 15,
      content: [{ type: 'text', text: 'x' }],
    });
    expect(body.duration).toBe(15);
  });

  it('sora-2 t2v (STRING seconds, size passthrough, no aspect_ratio/input_reference)', () => {
    const body = buildBody(CONFIGS['sora-2']!, { prompt: 'sunset', seconds: 8, size: '1280x720' });
    // Sora seconds is a string enum on the AIHubMix gateway; forced by wire name.
    expect(body).toEqual({ model: 'sora-2', prompt: 'sunset', seconds: '8', size: '1280x720' });
  });

  it('sora-2 i2v (input_reference OBJECT { image_url } + string seconds, no model switch)', () => {
    const body = buildBody(CONFIGS['sora-2']!, { prompt: 'clip', seconds: 4, size: '720x1280', finalReference: DATA });
    // Sora requires the object form (a bare string 400s) + string seconds; both forced by wire name.
    expect(body).toEqual({ model: 'sora-2', prompt: 'clip', seconds: '4', size: '720x1280', input_reference: { image_url: DATA } });
  });

  it('wan2.5 i2v (switches to apiModelI2V + flat input_reference)', () => {
    const body = buildBody(CONFIGS['wan2.5']!, { prompt: 'animate', seconds: 5, size: '1280x720', finalReference: DATA });
    expect(body).toEqual({
      model: 'wan2.5-i2v-preview',
      prompt: 'animate',
      seconds: 5,
      size: '1280x720',
      input_reference: DATA,
    });
  });

  it('jimeng-3.0-pro t2v (ratio-token size is a declared supported value → unchanged)', () => {
    const body = buildBody(CONFIGS['jimeng-3.0-pro']!, { prompt: 'x', seconds: 5, size: '16:9' });
    expect(body).toEqual({ model: 'jimeng-3.0-pro', prompt: 'x', seconds: 5, size: '16:9' });
  });

  it('extraBody is merged verbatim (no whitelist), matching create-task Object.assign', () => {
    const body = buildBody(CONFIGS['sora-2']!, {
      prompt: 'x',
      seconds: 8,
      size: '1280x720',
      extraBody: { quality: 'high', some_vendor_flag: true },
    });
    expect(body).toEqual({
      model: 'sora-2',
      prompt: 'x',
      seconds: '8',
      size: '1280x720',
      quality: 'high',
      some_vendor_flag: true,
    });
  });
});
