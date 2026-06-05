# @aihubmix/media-adapters

**English** | [中文](./README.zh-CN.md)

Pure, isomorphic interpreter that maps a **unified media request** to each
vendor's **native AIHubMix request shape**. No transport (fetch / auth / poll /
download / storage) and no proprietary model data baked in — model capabilities
are **injected**. Consumed by both [open-design](https://github.com/) and the
`aihubmix-video` playground so the per-vendor request shaping lives in one place.

## Why this exists

AIHubMix is a **passthrough** gateway: each upstream vendor keeps its native
request body, so the client must shape requests per vendor. AIHubMix's
`contract.json` already exposes an OpenAPI schema for the unified `/v1/videos`
surface, but today that surface is only normalised for the **OpenAI/Sora**
shape — seedance / happyhorse / wan native bodies are not in the contract. Until
the gateway normalises every vendor (the end-state, at which point this
interpreter can be deleted and only the capability contract remains), this
package carries the client-side mapping.

## Two layers

1. **Capability contract** (`src/contracts/`) — pure data describing each model:
   `caps`, `supported{Durations,Sizes,AspectRatios,Resolutions,FrameImages}`,
   `allowedPassthroughParameters`, `apiModelI2V`, optional `xSource` provenance.
   Field shape mirrors OpenRouter `/api/v1/videos/models` and AIHubMix
   `contract.json` so a future swap to a live `/api/v1/models` fetch is a
   data-source change, not a reshape. Designed for **video / image / audio**;
   video is implemented, image/audio contracts are stubbed.
2. **Request interpreter** (`src/adapters/`) — pure functions that turn a unified
   input + a capability into the vendor-native body. Video only, today.

## Video families

| family | models | wire shape |
|---|---|---|
| `seedance` | `doubao-seedance-*` | multimodal `content[]` (text + `image_url{url,role}`); `duration` number, `resolution` token, optional `ratio`/`watermark`/`camera_fixed`/`seed`/`generate_audio` |
| `dashscope` | `happyhorse-*` (Alibaba ATH), `wan2.7-i2v` | `{ input:{ prompt, media:[{type:first_frame\|last_frame,url}] }, parameters:{ resolution(UPPER), duration, prompt_extend, watermark } }` |
| `veo` | `veo-*` | flat `{ prompt, seconds(NUMBER), size, input_reference? }`; i2v via a single reference image (gateway maps to Veo `referenceImages` asset — not first/last frame) |
| `generic` | `sora-*`, `wan2.x`, `jimeng-*`, … | flat `{ prompt, seconds, size?, input_reference? }`; `seconds` form via `secondsFormat`; `aspect_ratio` never sent |

`happyhorse(dashscope)` / `wan` / `veo` are verified against the live AIHubMix
gateway and are stable. `seedance` / `generic` are a **superset that works for
two callers at once**: the snap helpers normalise wide inputs (an aspect-derived
pixel size, a bare aspect ratio) but are a **no-op on already-normalised inputs**
(a `720p` token, a declared supported size). So a caller whose UI already
constrains inputs (aihubmix-video) gets its bytes through unchanged, while a
caller that passes raw chat-tool inputs (open-design) gets them corrected — both
from the same code path. See `tests/parity-aihubmix-video.test.ts` and
`tests/open-design-inputs.test.ts`.

### Injected normalisation (capability fields)

Normalisation is driven by data on the capability, not hardcoded per model:

- `supportedDurations: number[]` — enum; `snapDuration` picks the nearest (ties → shorter).
- `durationRange: { min, max }` — continuous range; `snapDuration` clamps to it (e.g. SeeDance 4–15s keeps 15s). Ignored when `supportedDurations` is set.
- `supportedSizes: string[]` — declared sizes (WxH and/or ratio tokens); `snapSizeToSupported` returns a match unchanged, else maps by orientation (`generic` only).
- `secondsFormat: 'string' | 'number'` — wire form of `seconds` for `generic` (Sora's enum is a string on some gateways; default `'number'`).

## Model field capabilities: Official / Gateway / OR

Compares field capabilities across three sources, as the basis for integration and front-end value selection:

- **Official** — each vendor's real official API capability (Volcengine Ark / Alibaba Bailian DashScope / Google Veo / OpenAI Sora).
- **Gateway** — what the AIHubMix gateway actually supports after request rewriting/forwarding.
- **OR** — the field enums published by OpenRouter `GET /api/v1/videos/models`.

The gateway rewrites OpenAI-style requests into each vendor's native format: Official is usually the widest, the Gateway narrows it (rewriting or unimplemented features), and OR is a separate abstraction that may disagree with Official. This package's field values **follow Official, while accounting for actual Gateway behavior**.

Legend: **✓** aligned in this package; **⚠️** has a difference/limitation (see notes); `✗` not supported.

### SeeDance 2.0 / 2.0 Fast

| Field | Official | Gateway | OR | Status |
|---|---|---|---|---|
| frames | first_frame + last_frame + reference_image (+ reference_video) | same as Official (`content[].role`) | first_frame, last_frame | ✓ takes Official superset (keeps `reference_image`) |
| resolution | 480p / 720p / 1080p | derived from size short side → 480p/720p/1080p | 2.0: 480/720/1080; Fast: 480/720 | ✓ |
| aspect | 16:9 / 9:16 / 1:1 … | snap table lacks `9:21` | includes `9:21` | ⚠️ `9:21` only via direct `ratio`; via size it GCD-reduces to `3:7` |
| duration | 4–15s | clamp 2–15 | 4–15 | ✓ |
| seed / audio | yes / yes | passthrough | true / true | ✓ |

### Sora 2 Pro

| Field | Official | Gateway | OR | Status |
|---|---|---|---|---|
| sizes | 720x1280 / 1280x720 / 1024x1792 / 1792x1024 | pure passthrough | 1280x720 / 720x1280 / 1080x1920 / 1920x1080 | ✓ follows Official (**differs from OR**) |
| resolution | 720p / 1024p / 1080p | passthrough | 720p / 1080p | ✓ follows Official (incl. `1024p`) |
| durations | 4 / 8 / 12 (newer guide up to 16/20) | passthrough | 4 / 8 / 12 / 16 / 20 | ✓ takes the extended set |
| frames | `input_reference` = first frame | passthrough | null | ✓ `first_frame` (OR omits it from the frame enum) |
| seed | not supported | — | false | ✓ |
| audio | yes | passthrough | true | ✓ |

### Wan 2.6 / 2.7

| Field | Official | Gateway | OR | Status |
|---|---|---|---|---|
| resolution | 480P / 720P / 1080P | passthrough | 720p / 1080p | ✓ follows Official (incl. `480p`) |
| sizes | pixels, adapts to first-frame ratio | `x`→`*` + per-model default | 2.6: 4; 2.7: 10 | ✓ same pixel set as OR |
| duration | 2–15s | passthrough (no clamp) | 2.6: [5,10]; 2.7: [2–10] | ✓ follows Official 2–15 (gateway passthrough) |
| frames | first_frame + last_frame + reference | all supported | 2.6: first; 2.7: first+last | ✓ same as OR (2.6 first frame, 2.7 first+last) |
| audio | wan2.5/2.6 default on | default audio=true | true | ✓ |

### Veo 3.1 / 3.1 Lite

| Field | Official | Gateway | OR | Status |
|---|---|---|---|---|
| frames | `image` (first) + `lastFrame` (last) + `referenceImages` (asset) | **referenceImages (asset) only** | first_frame, last_frame | ⚠️ gateway supports only an asset reference; package declares `reference_image`, **cannot align** with Official/OR first+last frame |
| resolution | 3.1: 720p/1080p/4K; Lite: 720p/1080p | alias normalization | same as Official | ✓ |
| aspect | 16:9 / 9:16 | passthrough | 16:9 / 9:16 | ✓ |
| duration | 4 / 6 / 8 | passthrough | 4 / 6 / 8 | ✓ |
| seed / audio | yes / yes | passthrough | true / true | ✓ |

> **Front-end notes**: (1) default size/aspect **differ per model** (Sora defaults to portrait, Wan/Veo to landscape) — don't use a single default; (2) SeeDance's `9:21` only works via direct `ratio`; (3) Veo's i2v is an asset-style reference image, not a first/last frame.
>
> Sources: [Ark Seedance](https://www.volcengine.com/docs/82379/1520757), [Wan image-to-video](https://help.aliyun.com/zh/model-studio/image-to-video-api-reference/), [OpenAI Sora](https://developers.openai.com/api/docs/guides/video-generation), [Gemini Veo](https://ai.google.dev/gemini-api/docs/video); OpenRouter `/api/v1/videos/models`; AIHubMix gateway observed behavior.

## Usage

```ts
import { aihubmixMediaRegistry, buildVideoRequest } from '@aihubmix/media-adapters';

const cap = aihubmixMediaRegistry.get('aihubmix-happyhorse-1.0-i2v'); // prefix stripped
const built = buildVideoRequest(cap!, {
  prompt: 'a cat stretches',
  durationSeconds: 5,
  size: '1280x720',
  imageRef: { dataUrl }, // caller resolves the reference image to a data URL first
});
// caller does the transport:
// POST `${baseUrl}${built.pathSuffix}` with auth headers + JSON.stringify(built.body)
```

The package performs **no I/O**: resolve reference images to data URLs before
calling, and do the fetch/poll/download with the returned `{ pathSuffix, body }`.

## Scripts

- `pnpm build` — tsup → `dist/{index.js,index.cjs,index.d.ts}`
- `pnpm test` — vitest
- `pnpm typecheck` — tsc --noEmit
