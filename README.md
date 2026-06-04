# @aihubmix/media-adapters

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
| `dashscope` | `happyhorse-*` (Alibaba ATH) | `{ input:{ prompt, media:[{type:first_frame,url}] }, parameters:{ resolution(UPPER), duration, prompt_extend, watermark } }` |
| `veo` | `veo-*` | flat `{ prompt, seconds(NUMBER), size }`; t2v-only (Gemini predictLongRunning shim) |
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
