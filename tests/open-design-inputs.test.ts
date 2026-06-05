// Validation: @aihubmix/media-adapters ⟷ open-design `byok-tools.ts` call pattern
//
// open-design's chat tool (executeAIHubMixGenerateVideo) feeds the package a
// WIDE input: an aspect-derived PIXEL `size` (e.g. 1:1 → "1024x1024") plus the
// raw `aspectRatio`, and a synthesized capability. This suite proves the
// superset package STILL normalizes those inputs to gateway-valid wire bodies
// (it must, or open-design regresses to 400s) — the snap helpers fire for
// open-design while staying a no-op for aihubmix-video (see parity-aihubmix-video).
//
// NOTE: this is call-pattern validation, NOT byte-equality with open-design's
// pre-extraction in-repo copy — that copy intentionally differs (it routed wan
// via a DashScope family and emitted generic `seconds` as a string). The string
// form is reproduced here via the injected `secondsFormat:'string'`.

import { describe, expect, it } from 'vitest';
import { aihubmixMediaRegistry, buildVideoRequest, type ModelCapability } from '../src/index';

// open-design's exact aspect→pixel-size map (byok-tools.ts AIHUBMIX_VIDEO_ASPECT_TO_SIZE)
const ASPECT_TO_SIZE: Record<string, string> = {
  '16:9': '1280x720',
  '9:16': '720x1280',
  '1:1': '1024x1024',
  '4:3': '960x720',
  '3:4': '720x960',
};

const DATA = 'data:image/png;base64,aGVsbG8=';

// Mirror of open-design's call: it passes aspectRatio + an aspect-derived pixel size.
function buildLikeOpenDesign(cap: ModelCapability, aspect: string, duration: number, ref?: string) {
  return buildVideoRequest(cap, {
    prompt: 'a clip',
    durationSeconds: duration,
    aspectRatio: aspect,
    size: ASPECT_TO_SIZE[aspect],
    ...(ref ? { imageRef: { dataUrl: ref } } : {}),
  });
}

describe('open-design input style → gateway-valid bodies', () => {
  it('seedance: a 1:1 pixel size becomes a resolution TOKEN, never a WxH (Seedance 400 guard)', () => {
    const cap = aihubmixMediaRegistry.get('doubao-seedance-2-0-260128')!;
    const built = buildLikeOpenDesign(cap, '1:1', 5); // size 1024x1024
    expect(built.body.resolution).toBe('1080p'); // token by short side, NOT "1024x1024"
    expect(String(built.body.resolution)).not.toMatch(/x/);
    // aspect rides as seedance `ratio` (legal), never an invalid resolution.
    expect(built.body.ratio).toBe('1:1');
  });

  it('sora: an unsupported 1:1 pixel size is snapped to a supported one; aspect_ratio dropped', () => {
    const cap = aihubmixMediaRegistry.get('sora-2')!;
    const built = buildLikeOpenDesign(cap, '1:1', 8); // size 1024x1024 (unsupported)
    expect(built.body.size).toBe('1280x720'); // square → landscape supported
    expect(built.body.aspect_ratio).toBeUndefined(); // Sora rejects aspect_ratio
  });

  it('sora: open-design can keep its verified string seconds via injected secondsFormat', () => {
    const cap: ModelCapability = { ...aihubmixMediaRegistry.get('sora-2')!, secondsFormat: 'string' };
    const built = buildLikeOpenDesign(cap, '16:9', 8);
    expect(built.body.seconds).toBe('8'); // string enum, as open-design verified
  });

  it('veo: a 1:1 pixel size is snapped to a valid Veo size; i2v emits input_reference', () => {
    const cap = aihubmixMediaRegistry.get('veo-3.1-generate-preview')!;
    const built = buildLikeOpenDesign(cap, '1:1', 8, DATA); // with a reference image
    expect(built.body.size).toBe('1280x720');
    expect(built.body.input_reference).toBe(DATA); // gateway → Veo referenceImages asset
    expect(typeof built.body.seconds).toBe('number');
    // no reference → no input_reference
    expect(buildLikeOpenDesign(cap, '1:1', 8).body.input_reference).toBeUndefined();
  });

  it('regression guard: no open-design aspect yields a raw WxH where the gateway 400s', () => {
    const seedance = aihubmixMediaRegistry.get('doubao-seedance-2-0-260128')!;
    const sora = aihubmixMediaRegistry.get('sora-2')!;
    const veo = aihubmixMediaRegistry.get('veo-3.1-generate-preview')!;
    for (const aspect of Object.keys(ASPECT_TO_SIZE)) {
      // seedance resolution is always a token
      expect(String(buildLikeOpenDesign(seedance, aspect, 5).body.resolution)).toMatch(/^(480|720|1080)p$/);
      // sora size is always one of its declared supported sizes
      expect(sora.supportedSizes).toContain(buildLikeOpenDesign(sora, aspect, 8).body.size);
      // veo size is always a known-good Veo size
      expect(['1280x720', '720x1280', '1920x1080', '1080x1920']).toContain(
        buildLikeOpenDesign(veo, aspect, 8).body.size,
      );
    }
  });
});
