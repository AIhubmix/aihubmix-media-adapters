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

## 视频模型字段能力对照(官方 / 网关 / OR)

本表对照三处来源的字段能力,作为接入与前端取值的依据:

- **官方** — 各厂商官方 API 的真实能力(火山方舟 Ark / 阿里云百炼 DashScope / Google Veo / OpenAI Sora)。
- **网关** — AIHubMix 网关(转发改写后)实际支持的能力。
- **OR** — OpenRouter `GET /api/v1/videos/models` 公布的字段枚举。

网关将 OpenAI 风格请求重写为各厂商原生格式:通常官方能力最宽,网关因改写或未接而收窄,OR 为另一套抽象(可能与官方不一致)。本包字段取值**以官方为准、兼顾网关实际行为**。

图例:**✓** 本包已对齐;**⚠️** 存在差异或限制(见说明);`✗` 不支持。

### SeeDance 2.0 / 2.0 Fast

| 字段 | 官方 | 网关 | OR | 状态 |
|---|---|---|---|---|
| frames | first_frame + last_frame + reference_image (+ reference_video) | 同官方(`content[].role`) | first_frame, last_frame | ✓ 取官方全集(保留 `reference_image`) |
| resolution | 480p / 720p / 1080p | 由 size 短边推 480p/720p/1080p | 2.0:480/720/1080;Fast:480/720 | ✓ |
| 比例 | 16:9 / 9:16 / 1:1 … | 吸附表无 `9:21` | 含 `9:21` | ⚠️ `9:21` 仅 `ratio` 直传;走 size 会被约分成 `3:7` |
| duration | 4–15s | clamp 2–15 | 4–15 | ✓ |
| seed / audio | 支持 / 支持 | 透传 | true / true | ✓ |

### Sora 2 Pro

| 字段 | 官方 | 网关 | OR | 状态 |
|---|---|---|---|---|
| sizes | 720x1280 / 1280x720 / 1024x1792 / 1792x1024 | 纯透传 | 1280x720 / 720x1280 / 1080x1920 / 1920x1080 | ✓ 按官方(**与 OR 不同**) |
| resolution | 720p / 1024p / 1080p | 透传 | 720p / 1080p | ✓ 按官方(含 `1024p`) |
| durations | 4 / 8 / 12(新指南至 16/20) | 透传 | 4 / 8 / 12 / 16 / 20 | ✓ 取扩展集 |
| frames | `input_reference` = 首帧 | 透传 | null | ✓ `first_frame`(OR 未纳入帧枚举) |
| seed | 不支持 | — | false | ✓ |
| audio | 支持 | 透传 | true | ✓ |

### Wan 2.6 / 2.7

| 字段 | 官方 | 网关 | OR | 状态 |
|---|---|---|---|---|
| resolution | 480P / 720P / 1080P | 透传 | 720p / 1080p | ✓ 按官方(含 `480p`) |
| sizes | 像素,随首帧比例自适应 | `x`→`*` + 按模型填默认 | 2.6:4 个;2.7:10 个 | ✓ 同 OR 像素集 |
| duration | 2–15s | 透传(不 clamp) | 2.6:[5,10];2.7:[2–10] | ✓ 按官方 2–15(网关透传) |
| frames | first_frame + last_frame + 参考图 | 全支持 | 2.6:first;2.7:first+last | ✓ 同 OR(2.6 首帧、2.7 首尾帧) |
| audio | wan2.5/2.6 默认有声 | 默认 audio=true | true | ✓ |

### Veo 3.1 / 3.1 Lite

| 字段 | 官方 | 网关 | OR | 状态 |
|---|---|---|---|---|
| frames | `image`(首帧)+ `lastFrame`(尾帧)+ `referenceImages`(asset) | **仅 referenceImages(asset)** | first_frame, last_frame | ⚠️ 网关只支持 asset 参考图,本包标 `reference_image`,**无法对齐**官方/OR 的首尾帧 |
| resolution | 3.1:720p/1080p/4K;Lite:720p/1080p | 别名归一化 | 同官方 | ✓ |
| 比例 | 16:9 / 9:16 | 透传 | 16:9 / 9:16 | ✓ |
| duration | 4 / 6 / 8 | 透传 | 4 / 6 / 8 | ✓ |
| seed / audio | 支持 / 支持 | 透传 | true / true | ✓ |

> **前端注意**:① 默认 size/比例**各模型不同**(Sora 默认竖屏、Wan/Veo 默认横屏),不可用统一默认;② SeeDance 的 `9:21` 仅在以 `ratio` 直传时生效;③ Veo 的 i2v 是 asset 风格参考图,非首/尾帧。
>
> 来源:[Ark Seedance](https://www.volcengine.com/docs/82379/1520757)、[万相图生视频](https://help.aliyun.com/zh/model-studio/image-to-video-api-reference/)、[OpenAI Sora](https://developers.openai.com/api/docs/guides/video-generation)、[Gemini Veo](https://ai.google.dev/gemini-api/docs/video);OpenRouter `/api/v1/videos/models`;AIHubMix 网关实测行为。

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
