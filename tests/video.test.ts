import { describe, expect, it } from 'vitest';

import {
  buildVideoRequest,
  createCapabilityRegistry,
  deriveVideoFamily,
  normalizeModelId,
  normalizeVideoResponse,
  snapDuration,
  snapResolutionToken,
  snapVeoSize,
  snapSizeToSupported,
  aihubmixMediaRegistry,
  type ModelCapability,
} from '../src/index';

const SEEDANCE: ModelCapability = {
  id: 'doubao-seedance-2-0-260128',
  apiModel: 'doubao-seedance-2-0-260128',
  mediaType: 'video',
  family: 'seedance',
  caps: ['t2v', 'i2v'],
};

const VEO: ModelCapability = {
  id: 'veo-3.1-generate-preview',
  apiModel: 'veo-3.1-generate-preview',
  mediaType: 'video',
  family: 'veo',
  caps: ['t2v'], // veo is text-to-video only on the AIHubMix gateway (i2v rejected end-to-end)
  supportedDurations: [4, 6, 8],
};

const SORA: ModelCapability = {
  id: 'sora-2',
  apiModel: 'sora-2',
  mediaType: 'video',
  family: 'generic',
  caps: ['t2v', 'i2v'],
  supportedDurations: [4, 8, 12],
  supportedSizes: ['720x1280', '1280x720'],
};

const DATA_URL = 'data:image/png;base64,aGVsbG8=';

describe('capability registry', () => {
  it('normalizes the aihubmix- prefix on lookup', () => {
    expect(normalizeModelId('aihubmix-doubao-seedance-2-0-260128')).toBe('doubao-seedance-2-0-260128');
    const reg = createCapabilityRegistry([SEEDANCE]);
    expect(reg.get('aihubmix-doubao-seedance-2-0-260128')?.id).toBe(SEEDANCE.id);
    expect(reg.get('doubao-seedance-2-0-260128')?.id).toBe(SEEDANCE.id);
  });

  it('default registry maps each seeded model to its family', () => {
    expect(aihubmixMediaRegistry.get('doubao-seedance-2-0-260128')?.family).toBe('seedance');
    expect(aihubmixMediaRegistry.get('sora-2')?.family).toBe('generic');
    expect(aihubmixMediaRegistry.get('veo-3.1-generate-preview')?.family).toBe('veo');
    expect(aihubmixMediaRegistry.get('veo-3.1-lite-generate-preview')?.family).toBe('veo');
    // happyhorse is its own DashScope family; wan2.x is generic flat input_reference.
    expect(aihubmixMediaRegistry.get('happyhorse-1.0-i2v')?.family).toBe('dashscope');
    expect(aihubmixMediaRegistry.get('wan2.5-i2v-preview')?.family).toBe('generic');
    expect(aihubmixMediaRegistry.get('wan2.6-i2v')?.family).toBe('generic');
  });
});

describe('deriveVideoFamily', () => {
  it('routes seedance / dashscope(happyhorse) / veo / generic(wan,sora,jimeng) by wire name', () => {
    expect(deriveVideoFamily('doubao-seedance-2-0-260128')).toBe('seedance');
    expect(deriveVideoFamily('happyhorse-1.0-i2v')).toBe('dashscope');
    expect(deriveVideoFamily('veo-3.1-generate-preview')).toBe('veo');
    expect(deriveVideoFamily('veo-3.1-lite-generate-preview')).toBe('veo');
    // wan2.x is generic (gateway-normalised flat input_reference), NOT dashscope.
    expect(deriveVideoFamily('wan2.5-i2v-preview')).toBe('generic');
    expect(deriveVideoFamily('wan2.6-i2v')).toBe('generic');
    expect(deriveVideoFamily('sora-2')).toBe('generic');
    expect(deriveVideoFamily('jimeng-3.0-pro')).toBe('generic');
  });

  it('honours an explicit family override on the capability', () => {
    expect(deriveVideoFamily('mystery-1', { ...SEEDANCE, family: 'dashscope' })).toBe('dashscope');
  });
});

describe('snapDuration', () => {
  it('enum: snaps to allowed set (ties → shorter)', () => {
    expect(snapDuration(VEO, 5)).toBe(4); // veo 4/6/8, tie→shorter
    expect(snapDuration(VEO, 7)).toBe(6);
    expect(snapDuration(VEO, 10)).toBe(8);
  });
  it('durationRange: clamps to [min,max] (keeps in-range values verbatim)', () => {
    const cap: ModelCapability = { ...SEEDANCE, durationRange: { min: 4, max: 15 } };
    expect(snapDuration(cap, 5)).toBe(5);
    expect(snapDuration(cap, 15)).toBe(15); // not clamped to 12
    expect(snapDuration(cap, 99)).toBe(15);
    expect(snapDuration(cap, 2)).toBe(4);
  });
  it('no constraint: built-in 3-12 clamp', () => {
    expect(snapDuration(SEEDANCE, 5)).toBe(5);
    expect(snapDuration(SEEDANCE, 99)).toBe(12);
    expect(snapDuration(SEEDANCE, 1)).toBe(3);
  });
});

describe('buildVideoRequest — seedance family', () => {
  it('t2v: multimodal content array; no resolution when none supplied', () => {
    const built = buildVideoRequest(SEEDANCE, { prompt: 'a panda', durationSeconds: 5 });
    expect(built.family).toBe('seedance');
    expect(built.pathSuffix).toBe('/videos');
    expect(built.contentType).toBe('application/json');
    expect(built.hasReference).toBe(false);
    expect(built.body.model).toBe('doubao-seedance-2-0-260128');
    expect(built.body.duration).toBe(5);
    expect(built.body.content).toEqual([{ type: 'text', text: 'a panda' }]);
    expect(built.body.resolution).toBeUndefined(); // omitted, matching aihubmix-video
    expect(built.body.input_reference).toBeUndefined();
  });

  it('i2v: adds the reference image as image_url with role first_frame', () => {
    const built = buildVideoRequest(SEEDANCE, {
      prompt: 'animate the panda',
      durationSeconds: 5,
      imageRef: { dataUrl: DATA_URL },
    });
    expect(built.hasReference).toBe(true);
    const content = built.body.content as any[];
    expect(content[0]).toEqual({ type: 'text', text: 'animate the panda' });
    expect(content[1]).toEqual({ type: 'image_url', image_url: { url: DATA_URL }, role: 'first_frame' });
  });

  it('flf2v: emits first_frame + last_frame + reference_image content items in order', () => {
    const LAST_URL = 'data:image/png;base64,LAST';
    const REF_URL = 'data:image/png;base64,REF';
    const built = buildVideoRequest(SEEDANCE, {
      prompt: 'morph',
      imageRef: { dataUrl: DATA_URL },
      lastFrameRef: { dataUrl: LAST_URL },
      extraImageRefs: [{ dataUrl: REF_URL }],
    });
    const content = built.body.content as any[];
    expect(content[1]).toEqual({ type: 'image_url', image_url: { url: DATA_URL }, role: 'first_frame' });
    expect(content[2]).toEqual({ type: 'image_url', image_url: { url: LAST_URL }, role: 'last_frame' });
    expect(content[3]).toEqual({ type: 'image_url', image_url: { url: REF_URL }, role: 'reference_image' });
  });

  it('resolution: token in → no-op; pixel size → snapped to token', () => {
    // aihubmix-video supplies a token (480p/720p) → unchanged.
    expect(buildVideoRequest(SEEDANCE, { prompt: 'x', resolution: '720p' }).body.resolution).toBe('720p');
    expect(buildVideoRequest(SEEDANCE, { prompt: 'x', size: '720p' }).body.resolution).toBe('720p');
    // open-design supplies an aspect-derived pixel size → converted (Seedance 400s on a WxH resolution).
    expect(buildVideoRequest(SEEDANCE, { prompt: 'x', size: '1280x720' }).body.resolution).toBe('720p');
    // explicit token wins over size
    expect(buildVideoRequest(SEEDANCE, { prompt: 'x', resolution: '1080p', size: '1280x720' }).body.resolution).toBe('1080p');
  });

  it('ratio alias + watermark/camera_fixed/seed/generate_audio passthrough', () => {
    const built = buildVideoRequest(SEEDANCE, {
      prompt: 'x',
      durationSeconds: 5,
      ratio: '21:9',
      aspectRatio: '16:9', // ratio wins
      watermark: false,
      cameraFixed: true,
      seed: 42,
      generateAudio: true,
    });
    expect(built.body.ratio).toBe('21:9');
    expect(built.body.watermark).toBe(false);
    expect(built.body.camera_fixed).toBe(true);
    expect(built.body.seed).toBe(42);
    expect(built.body.generate_audio).toBe(true);
  });

  it('content passthrough: uses a pre-resolved content[] verbatim', () => {
    const content = [
      { type: 'text', text: 'cut' },
      { type: 'image_url', image_url: { url: DATA_URL }, role: 'first_frame' },
      { type: 'image_url', image_url: { url: DATA_URL }, role: 'last_frame' },
      { type: 'video_url', video_url: { url: 'https://x/y.mp4' }, role: 'reference_video' },
    ];
    const built = buildVideoRequest(SEEDANCE, { prompt: 'ignored-when-content', content });
    expect(built.body.content).toBe(content);
  });

  it('durationRange keeps 15s for SeeDance (not clamped to 12)', () => {
    const cap: ModelCapability = { ...SEEDANCE, durationRange: { min: 4, max: 15 } };
    expect(buildVideoRequest(cap, { prompt: 'x', durationSeconds: 15 }).body.duration).toBe(15);
  });
});

describe('buildVideoRequest — dashscope family (happyhorse) [verified, unchanged]', () => {
  const HAPPYHORSE: ModelCapability = {
    id: 'happyhorse-1.0-i2v',
    apiModel: 'happyhorse-1.0-i2v',
    mediaType: 'video',
    family: 'dashscope',
    caps: ['i2v'],
    supportedFrameImages: ['first_frame'],
    supportedResolutions: ['480P', '720P', '1080P'],
  };

  it('i2v: builds the DashScope input.media + parameters shape (uppercase token)', () => {
    const built = buildVideoRequest(HAPPYHORSE, {
      prompt: 'cat stretches',
      durationSeconds: 5,
      size: '1280x720',
      imageRef: { dataUrl: DATA_URL },
    });
    expect(built.family).toBe('dashscope');
    expect(built.hasReference).toBe(true);
    expect(built.body.prompt).toBeUndefined();
    expect(built.body.input_reference).toBeUndefined();
    expect(built.body).toMatchObject({
      model: 'happyhorse-1.0-i2v',
      input: { prompt: 'cat stretches', media: [{ type: 'first_frame', url: DATA_URL }] },
      parameters: { resolution: '720P', duration: 5, prompt_extend: true, watermark: false },
    });
  });

  it('t2v: omits media when there is no reference image', () => {
    const built = buildVideoRequest(
      { ...HAPPYHORSE, id: 'dash-t2v', apiModel: 'happyhorse-1.0-t2v', caps: ['t2v'] },
      { prompt: 'a sunset', durationSeconds: 5 },
    );
    expect((built.body.input as any).media).toBeUndefined();
    expect((built.body.input as any).prompt).toBe('a sunset');
    expect((built.body.parameters as any).resolution).toBe('720P');
  });

  it('flf2v: appends a last_frame media entry after first_frame', () => {
    const LAST_URL = 'data:image/png;base64,LAST';
    const built = buildVideoRequest(HAPPYHORSE, {
      prompt: 'morph',
      durationSeconds: 5,
      size: '1280x720',
      imageRef: { dataUrl: DATA_URL },
      lastFrameRef: { dataUrl: LAST_URL },
    });
    expect((built.body.input as any).media).toEqual([
      { type: 'first_frame', url: DATA_URL },
      { type: 'last_frame', url: LAST_URL },
    ]);
  });
});

describe('buildVideoRequest — veo family [verified, unchanged]', () => {
  it('t2v: seconds is a NUMBER and size only — no aspect_ratio', () => {
    const built = buildVideoRequest(VEO, {
      prompt: 'a sunset',
      durationSeconds: 5, // veo → snapped to 4
      aspectRatio: '16:9',
      size: '1280x720',
    });
    expect(built.family).toBe('veo');
    expect(built.body).toMatchObject({
      model: 'veo-3.1-generate-preview',
      prompt: 'a sunset',
      seconds: 4,
      size: '1280x720',
    });
    expect(typeof built.body.seconds).toBe('number');
    expect(built.body.aspect_ratio).toBeUndefined();
    expect(built.body.resolution).toBeUndefined();
    expect(built.body.input_reference).toBeUndefined();
  });

  it('snaps an out-of-range size (1:1) to a valid landscape Veo size', () => {
    const built = buildVideoRequest(VEO, { prompt: 'square clip', durationSeconds: 8, size: '1024x1024' });
    expect(built.body.size).toBe('1280x720');
  });

  it('t2v-only: never emits input_reference even if a reference image is passed', () => {
    // veo i2v is rejected end-to-end on the gateway; the adapter must not attach one.
    const built = buildVideoRequest(VEO, {
      prompt: 'clip',
      durationSeconds: 6,
      imageRef: { dataUrl: DATA_URL },
      lastFrameRef: { dataUrl: 'data:image/png;base64,LAST' },
      extraImageRefs: [{ dataUrl: 'data:image/png;base64,REF' }],
    });
    expect(built.body.input_reference).toBeUndefined();
    expect(JSON.stringify(built.body)).not.toContain('last_frame');
    expect(built.body.seconds).toBe(6);
  });
});

describe('buildVideoRequest — generic family (sora + wan2.x + jimeng)', () => {
  it('default: seconds is a NUMBER; size passes through; aspect_ratio dropped; no input_reference', () => {
    const built = buildVideoRequest(SORA, {
      prompt: 'a sunset',
      durationSeconds: 5, // sora 4/8/12 → 4
      aspectRatio: '16:9', // must NOT reach the wire
      size: '1280x720',
    });
    expect(built.family).toBe('generic');
    expect(built.body).toMatchObject({ model: 'sora-2', prompt: 'a sunset', seconds: 4, size: '1280x720' });
    expect(typeof built.body.seconds).toBe('number');
    expect(built.body.aspect_ratio).toBeUndefined();
    expect(built.body.input_reference).toBeUndefined();
  });

  it('secondsFormat:"string" emits the Sora-style string enum', () => {
    const built = buildVideoRequest({ ...SORA, secondsFormat: 'string' }, { prompt: 'x', durationSeconds: 8 });
    expect(built.body.seconds).toBe('8');
  });

  it('size: declared supported value → no-op; pixel/odd size → snapped by orientation', () => {
    // aihubmix-video supplies an already-supported size → unchanged
    expect(buildVideoRequest(SORA, { prompt: 's', durationSeconds: 8, size: '1280x720' }).body.size).toBe('1280x720');
    // open-design supplies an unsupported size → snapped to same orientation
    expect(buildVideoRequest(SORA, { prompt: 's', durationSeconds: 8, size: '1024x1024' }).body.size).toBe('1280x720');
    expect(buildVideoRequest(SORA, { prompt: 't', durationSeconds: 8, size: '720x960' }).body.size).toBe('720x1280');
  });

  it('size omitted entirely when the caller supplies none', () => {
    const built = buildVideoRequest(SORA, { prompt: 's', durationSeconds: 8 });
    expect(built.body.size).toBeUndefined();
  });

  it('no supportedSizes constraint → size passes through raw (jimeng-style ratio token)', () => {
    const JIMENG: ModelCapability = {
      id: 'jimeng-3.0-pro',
      apiModel: 'jimeng-3.0-pro',
      mediaType: 'video',
      family: 'generic',
      caps: ['t2v', 'i2v'],
      supportedSizes: ['16:9', '9:16', '1920x1080'],
    };
    expect(buildVideoRequest(JIMENG, { prompt: 'x', durationSeconds: 5, size: '16:9' }).body.size).toBe('16:9');
    expect(buildVideoRequest(JIMENG, { prompt: 'x', durationSeconds: 5, size: '1920x1080' }).body.size).toBe('1920x1080');
  });

  it('i2v: attaches input_reference (data URL or public URL) and switches the wire model', () => {
    const WAN: ModelCapability = {
      id: 'wan2.5',
      apiModel: 'wan2.5-t2v-preview',
      apiModelI2V: 'wan2.5-i2v-preview',
      mediaType: 'video',
      family: 'generic',
      caps: ['t2v', 'i2v'],
      supportedDurations: [5, 10],
    };
    const built = buildVideoRequest(WAN, { prompt: 'animate', durationSeconds: 5, imageRef: { dataUrl: DATA_URL } });
    expect(built.wireModel).toBe('wan2.5-i2v-preview');
    expect(built.body.model).toBe('wan2.5-i2v-preview');
    expect(built.body.input_reference).toBe(DATA_URL);
    expect((built.body as any).input).toBeUndefined(); // NOT the DashScope input.media shape
    expect(built.body.seconds).toBe(5); // number
    // a public URL string survives too (field name is a slight misnomer)
    const built2 = buildVideoRequest(WAN, { prompt: 'a', durationSeconds: 5, imageRef: { dataUrl: 'https://x/y.png' } });
    expect(built2.body.input_reference).toBe('https://x/y.png');
  });

  it('i2v input_reference shape: Sora → OBJECT { image_url }, wan → bare string (registry caps)', () => {
    // Sora requires the object form; gateway/OpenAI 400s on a string.
    const sora = aihubmixMediaRegistry.get('sora-2')!;
    const s = buildVideoRequest(sora, { prompt: 'animate', durationSeconds: 8, imageRef: { dataUrl: DATA_URL } });
    expect(typeof s.body.input_reference).toBe('object');
    expect(s.body.input_reference).toEqual({ image_url: DATA_URL });
    // wan keeps the bare string (verified working) — must NOT regress to an object.
    const wan = aihubmixMediaRegistry.get('wan2.6-i2v')!;
    const w = buildVideoRequest(wan, { prompt: 'animate', durationSeconds: 5, imageRef: { dataUrl: DATA_URL } });
    expect(typeof w.body.input_reference).toBe('string');
    expect(w.body.input_reference).toBe(DATA_URL);
  });
});

describe('buildVideoRequest — apiModelI2V + passthrough', () => {
  it('switches to apiModelI2V when a reference image is present', () => {
    const cap: ModelCapability = {
      id: 'wan2.5',
      apiModel: 'wan2.5-t2v-preview',
      apiModelI2V: 'wan2.5-i2v-preview',
      mediaType: 'video',
      family: 'generic',
      caps: ['t2v', 'i2v'],
    };
    expect(buildVideoRequest(cap, { prompt: 'x' }).wireModel).toBe('wan2.5-t2v-preview');
    expect(buildVideoRequest(cap, { prompt: 'x', imageRef: { dataUrl: DATA_URL } }).wireModel).toBe(
      'wan2.5-i2v-preview',
    );
  });

  it('merges extraBodyDefaults and only whitelisted passthrough keys', () => {
    const cap: ModelCapability = {
      id: 'm',
      apiModel: 'm',
      mediaType: 'video',
      family: 'generic',
      caps: ['t2v'],
      allowedPassthroughParameters: ['mode'],
      extraBodyDefaults: [{ name: 'mode', type: 'string', default: 'std' }],
    };
    const built = buildVideoRequest(cap, { prompt: 'x', passthrough: { mode: 'pro', not_allowed: 'drop-me' } });
    expect(built.body.mode).toBe('pro'); // passthrough overrides default
    expect(built.body.not_allowed).toBeUndefined(); // non-whitelisted dropped
  });
});

describe('snapVeoSize / snapSizeToSupported / snapResolutionToken', () => {
  it('snapVeoSize: passes known-good, maps out-of-range by orientation, defaults landscape', () => {
    expect(snapVeoSize('1280x720')).toBe('1280x720');
    expect(snapVeoSize('1024x1024')).toBe('1280x720');
    expect(snapVeoSize('720x960')).toBe('720x1280');
    expect(snapVeoSize(undefined)).toBe('1280x720');
  });

  it('snapSizeToSupported: unchanged when unconstrained, else maps by orientation', () => {
    expect(snapSizeToSupported('1024x1024', undefined)).toBe('1024x1024');
    const SUP = ['720x1280', '1280x720'];
    expect(snapSizeToSupported('1280X720', SUP)).toBe('1280x720');
    expect(snapSizeToSupported('1024x1024', SUP)).toBe('1280x720');
    expect(snapSizeToSupported(undefined, SUP)).toBe('1280x720');
  });

  it('snapResolutionToken: token wins, WxH→short-side token, default 720p', () => {
    expect(snapResolutionToken('1080P', undefined)).toBe('1080p');
    expect(snapResolutionToken(undefined, '1920x1080')).toBe('1080p');
    expect(snapResolutionToken(undefined, '854x480')).toBe('480p');
    expect(snapResolutionToken('garbage', 'nope')).toBe('720p');
  });
});

describe('normalizeVideoResponse', () => {
  it('extracts id/status/url/error across vendor response shapes', () => {
    expect(normalizeVideoResponse({ id: 'v1', status: 'in_progress' })).toMatchObject({ id: 'v1', status: 'in_progress' });
    expect(normalizeVideoResponse({ data: { task_id: 't2', video_url: 'http://x/y.mp4' } })).toMatchObject({
      id: 't2',
      url: 'http://x/y.mp4',
    });
    expect(normalizeVideoResponse({ error: { message: 'boom' } }).error).toBe('boom');
    expect(normalizeVideoResponse({ failure_reason: 'nope' }).error).toBe('nope');
  });
});
