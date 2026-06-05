# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project adheres to
[Semantic Versioning](https://semver.org/).

## 0.2.1

### Bug fixes

- **Sora i2v still sent `input_reference` as a string when the caller injected its
  own capabilities.** 0.2.0 only switched to the object form when the capability
  carried `referenceAsObject: true`; consumers that inject their own catalogue
  (not the bundled seed) lacked the flag and kept hitting the 400. The object form
  is now also force-detected by wire name (`sora*`), so Sora always emits
  `input_reference: { image_url }` regardless of capability source.
  `referenceAsObject` remains an explicit opt-in for any other vendor.

## 0.2.0

### Bug fixes

- **Sora i2v 400 — `input_reference` must be an object.** The generic branch sent
  `input_reference` as a bare string, which the gateway/OpenAI rejects
  (`Invalid type for 'input_reference': expected an object, but got a string`).
  Sora now emits `input_reference: { image_url: <url> }`; other generic vendors
  (wan2.x) keep the bare string. Selected per model via the new
  `referenceAsObject` capability flag.
- **SeeDance 1.x 400 — `task_type r2v does not support model`.** SeeDance 1.x
  (`doubao-seedance-1-0-pro`, `-fast`, `1-5-pro`) only supports first-frame i2v,
  not r2v. They were missing from the seed, so consumers couldn't tell. Added
  with `supportedFrameImages: ['first_frame']` (no `reference_image`).
- **Veo i2v rejected end-to-end — reverted to t2v-only.** On the AIHubMix gateway
  Veo image-to-video is not accepted in practice, so `veo-3.1` / `veo-3.1-lite`
  `caps` are back to `['t2v']`, `supportedFrameImages` removed, and the adapter no
  longer attaches `input_reference` for Veo.

### Features

- **Last-frame (FLF2V) support.** New `lastFrameRef` input; emitted as
  `content[].role: last_frame` (seedance) and `input.media[type:last_frame]`
  (dashscope, e.g. wan2.7-i2v).
- **New models seeded:** SeeDance 1.0 Pro / 1.0 Pro Fast / 1.5 Pro.
- **New capability fields:** `referenceAsObject` (object-form `input_reference`),
  `lastFrameRef` (last-frame reference input).

### Field alignment (Official / OpenRouter)

- **Sora 2 Pro** — sizes follow OpenAI **official** enum
  (`720x1280/1280x720/1024x1792/1792x1024`, diverges from OpenRouter); added
  `1024p` resolution; durations extended to `4/8/12/16/20`.
- **Wan 2.6 / 2.7** — added `480p`; duration widened to official `2–15s` (gateway
  passthrough); declared `seed` / `generateAudio`; wan2.7 added `last_frame` and
  the full 10-size set.
- **SeeDance 2.0 / Fast** — added `1080p`, `9:21`, `last_frame` (kept
  `reference_image`).
- **Veo 3.1 / Lite** — added `supportedResolutions` (incl. 4K) and
  `seed` / `generateAudio` (i2v frames reverted — see Bug fixes).

### Docs

- README is now English-only with a language link; added `README.zh-CN.md`.
- Added an Official / Gateway / OR field-capability comparison to both READMEs.

### Packaging

- Added `publishConfig.access: public` (required for the scoped package).

## 0.1.0

- Initial release: pure, isomorphic video request-shaping for the AIHubMix
  gateway (seedance / dashscope / veo / generic families); capabilities injected
  via a seed catalogue.
