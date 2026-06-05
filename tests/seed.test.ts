// Seed coverage — asserts the curated catalogue matches aihubmix-video's live
// /api/models/video list (the production source of truth) plus open-design's veo.

import { describe, expect, it } from 'vitest';
import { aihubmixMediaRegistry, deriveVideoFamily, type ModelCapability } from '../src/index';

const get = (id: string): ModelCapability => {
  const c = aihubmixMediaRegistry.get(id);
  if (!c) throw new Error(`missing seed: ${id}`);
  return c;
};

describe('seed — coverage of aihubmix-video live catalogue', () => {
  it('has every live video model keyed by wire id', () => {
    for (const id of [
      'doubao-seedance-2-0-260128',
      'doubao-seedance-2-0-fast-260128',
      'doubao-seedance-1-0-pro-250528',
      'doubao-seedance-1-0-pro-fast-251015',
      'doubao-seedance-1-5-pro-251215',
      'sora-2',
      'sora-2-pro',
      'wan2.6-t2v',
      'wan2.6-i2v',
      'wan2.5-t2v-preview',
      'wan2.5-i2v-preview',
      'jimeng-3.0-pro',
      'jimeng-3.0-1080p',
      'happyhorse-1.0-t2v',
      'happyhorse-1.0-i2v',
    ]) {
      expect(aihubmixMediaRegistry.get(id), id).toBeDefined();
    }
  });

  it('seeds wan2.7 (back in the live catalogue): t2v generic, i2v DashScope-native', () => {
    // wan2.7 is served by the live catalogue again. Its t2v takes the flat generic
    // body, but its i2v requires the DashScope input.media shape (verified against a
    // working wan2.7-i2v call) — so the family must route per wire name.
    expect(get('wan2.7-t2v')).toMatchObject({ apiModelI2V: 'wan2.7-i2v', caps: ['t2v', 'i2v'] });
    expect(deriveVideoFamily('wan2.7-t2v')).toBe('generic');
    expect(deriveVideoFamily('wan2.7-i2v')).toBe('dashscope');
  });

  it('keeps open-design-verified veo (not in aihubmix-video catalogue)', () => {
    expect(get('veo-3.1-generate-preview').family).toBe('veo');
    expect(get('veo-3.1-lite-generate-preview').family).toBe('veo');
  });

  it('carries label + vendorGroup for picker discovery + grouping', () => {
    expect(get('doubao-seedance-2-0-260128')).toMatchObject({ label: 'SeeDance 2.0', vendorGroup: 'ByteDance' });
    expect(get('sora-2').vendorGroup).toBe('OpenAI');
    expect(get('wan2.5-t2v-preview').vendorGroup).toBe('Alibaba');
    expect(get('jimeng-3.0-pro').vendorGroup).toBe('Jimeng AI');
    expect(get('happyhorse-1.0-t2v').vendorGroup).toBe('Alibaba');
  });

  it('seedance: full params (durationRange 4–15, resolution tokens, toggles)', () => {
    const s = get('doubao-seedance-2-0-260128');
    expect(s.durationRange).toEqual({ min: 4, max: 15 });
    expect(s.supportedResolutions).toEqual(['480p', '720p', '1080p']);
    expect(s.supportedAspectRatios).toContain('21:9');
    expect(s.supportedAspectRatios).toContain('9:21');
    expect(s.supportedFrameImages).toEqual(['first_frame', 'last_frame', 'reference_image']);
    expect(s).toMatchObject({ generateAudio: true, seed: true, watermark: true, cameraFixed: true });
    expect(s.caps).toEqual(['t2v', 'i2v']);
  });

  it('seedance 1.x: first-frame ONLY (no reference_image/r2v); 2.0 keeps reference_image', () => {
    for (const id of [
      'doubao-seedance-1-0-pro-250528',
      'doubao-seedance-1-0-pro-fast-251015',
      'doubao-seedance-1-5-pro-251215',
    ]) {
      expect(get(id).family, id).toBe('seedance');
      expect(get(id).supportedFrameImages, id).toEqual(['first_frame']);
    }
    // 2.0 still supports r2v (reference_image) — regression guard.
    expect(get('doubao-seedance-2-0-260128').supportedFrameImages).toContain('reference_image');
  });

  it('sora-2: 4 supported sizes (enriched from 2) + duration enum', () => {
    const s = get('sora-2');
    expect(s.supportedSizes).toEqual(['720x1280', '1280x720', '1024x1792', '1792x1024']);
    expect(s.supportedDurations).toEqual([4, 8, 12]);
  });

  it('sora-2-pro: OFFICIAL sizes/resolutions (not OR) + extended durations + audio', () => {
    const s = get('sora-2-pro');
    // official OpenAI sizes (diverges from OR's 1080x1920/1920x1080)
    expect(s.supportedSizes).toEqual(['720x1280', '1280x720', '1024x1792', '1792x1024']);
    expect(s.supportedResolutions).toEqual(['720p', '1024p', '1080p']);
    expect(s.supportedDurations).toEqual([4, 8, 12, 16, 20]);
    expect(s.supportedFrameImages).toEqual(['first_frame']);
    expect(s.generateAudio).toBe(true);
  });

  it('wan2.6/2.7: official 480p + 2–15s (gateway passthrough); wan2.7 adds last_frame', () => {
    expect(get('wan2.6-t2v').supportedResolutions).toEqual(['480p', '720p', '1080p']);
    expect(get('wan2.6-i2v').durationRange).toEqual({ min: 2, max: 15 });
    expect(get('wan2.7-t2v').supportedResolutions).toEqual(['480p', '720p', '1080p']);
    expect(get('wan2.7-t2v').durationRange).toEqual({ min: 2, max: 15 });
    expect(get('wan2.7-t2v').supportedFrameImages).toEqual(['first_frame', 'last_frame']);
    expect(get('wan2.7-i2v').supportedFrameImages).toEqual(['first_frame', 'last_frame']);
  });

  it('veo: t2v-only (i2v rejected by gateway) + resolutions (4K on 3.1, none on lite)', () => {
    const v = get('veo-3.1-generate-preview');
    expect(v.caps).toEqual(['t2v']);
    expect(v.supportedFrameImages).toBeUndefined();
    expect(v.supportedResolutions).toEqual(['720p', '1080p', '4K']);
    expect(get('veo-3.1-lite-generate-preview').caps).toEqual(['t2v']);
    expect(get('veo-3.1-lite-generate-preview').supportedResolutions).toEqual(['720p', '1080p']);
  });

  it('wan: generic family, sizes, durationRange/enum, i2v variant + apiModelI2V', () => {
    expect(get('wan2.6-t2v')).toMatchObject({ family: 'generic', apiModelI2V: 'wan2.6-i2v' });
    // duration follows OFFICIAL DashScope wan i2v (2–15s); gateway is passthrough.
    expect(get('wan2.6-t2v').durationRange).toEqual({ min: 2, max: 15 });
    expect(get('wan2.6-t2v').supportedDurations).toBeUndefined();
    expect(get('wan2.5-t2v-preview')).toMatchObject({ family: 'generic', apiModelI2V: 'wan2.5-i2v-preview' });
    expect(get('wan2.5-t2v-preview').supportedDurations).toEqual([5, 10]);
    expect(get('wan2.5-i2v-preview').caps).toEqual(['i2v']);
  });

  it('jimeng: generic, size list mixes ratio tokens + WxH', () => {
    const j = get('jimeng-3.0-pro');
    expect(j.family).toBe('generic');
    expect(j.supportedSizes).toContain('16:9');
    expect(j.supportedSizes).toContain('2176x928');
    expect(j.supportedDurations).toEqual([5, 10]);
  });

  it('happyhorse: dashscope family, t2v+i2v, durationRange 3–15, apiModelI2V', () => {
    const h = get('happyhorse-1.0-t2v');
    expect(h).toMatchObject({ family: 'dashscope', apiModelI2V: 'happyhorse-1.0-i2v', caps: ['t2v', 'i2v'] });
    expect(h.durationRange).toEqual({ min: 3, max: 15 });
    expect(h.supportedResolutions).toEqual(['1080P', '720P']);
    expect(get('happyhorse-1.0-i2v').family).toBe('dashscope');
  });
});
