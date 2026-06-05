# @aihubmix/media-adapters

[English](./README.md) | **中文**

纯函数、同构的解释器,把**统一的媒体请求**映射为各厂商在 AIHubMix 上的**原生请求形态**。不含任何传输逻辑(fetch / 鉴权 / 轮询 / 下载 / 存储),也不内置任何专有模型数据——模型能力通过**注入**提供。被 [open-design](https://github.com/) 与 `aihubmix-video` playground 共同复用,使"按厂商整形请求"的逻辑只存在于一处。

## 为什么需要它

AIHubMix 是一个**透传**网关:每个上游厂商保留各自的原生请求体,因此客户端必须按厂商整形请求。AIHubMix 的 `contract.json` 虽已为统一的 `/v1/videos` 暴露了 OpenAPI schema,但目前只对 **OpenAI/Sora** 形态做了归一化——seedance / happyhorse / wan 的原生请求体并不在该 contract 内。在网关把每个厂商都归一化之前(那是终局,届时本解释器即可删除、只保留能力契约),本包承担客户端侧的映射。

## 两层结构

1. **能力契约**(`src/contracts/`)——描述每个模型的纯数据:`caps`、`supported{Durations,Sizes,AspectRatios,Resolutions,FrameImages}`、`allowedPassthroughParameters`、`apiModelI2V`、可选的 `xSource` 溯源。字段形态对齐 OpenRouter `/api/v1/videos/models` 与 AIHubMix `contract.json`,因此未来切换到实时 `/api/v1/models` 拉取只是换数据源,而非重构形态。面向 **video / image / audio** 设计;video 已实现,image/audio 契约为占位。
2. **请求解释器**(`src/adapters/`)——把统一输入 + 能力契约转成厂商原生请求体的纯函数。目前仅 video。

## 视频请求家族(family)

| family | 模型 | 线上形态 |
|---|---|---|
| `seedance` | `doubao-seedance-*` | 多模态 `content[]`(text + `image_url{url,role}`);`duration` 数字、`resolution` token,可选 `ratio`/`watermark`/`camera_fixed`/`seed`/`generate_audio` |
| `dashscope` | `happyhorse-*`(Alibaba ATH)、`wan2.7-i2v` | `{ input:{ prompt, media:[{type:first_frame\|last_frame,url}] }, parameters:{ resolution(大写), duration, prompt_extend, watermark } }` |
| `veo` | `veo-*` | 扁平 `{ prompt, seconds(数字), size, input_reference? }`;i2v 走单张参考图(网关映射为 Veo `referenceImages` asset——非首/尾帧) |
| `generic` | `sora-*`、`wan2.x`、`jimeng-*`、… | 扁平 `{ prompt, seconds, size?, input_reference? }`;`seconds` 形态由 `secondsFormat` 决定;从不发送 `aspect_ratio` |

`happyhorse(dashscope)` / `wan` / `veo` 已对 AIHubMix 线上网关验证、稳定。`seedance` / `generic` 是一个**同时服务两个调用方的超集**:snap 辅助函数会归一化偏宽的输入(由比例推出的像素 size、裸宽高比),但对**已归一化的输入是 no-op**(一个 `720p` token、一个已声明的 supported size)。因此 UI 已约束输入的调用方(aihubmix-video)字节原样通过,而传入原始聊天工具输入的调用方(open-design)会被纠正——两者走同一代码路径。见 `tests/parity-aihubmix-video.test.ts` 与 `tests/open-design-inputs.test.ts`。

### 注入式归一化(能力字段驱动)

归一化由能力上的数据驱动,而非按模型硬编码:

- `supportedDurations: number[]` —— 枚举;`snapDuration` 取最近(并列取更短)。
- `durationRange: { min, max }` —— 连续区间;`snapDuration` 钳制到区间(如 SeeDance 4–15s 保留 15s)。设了 `supportedDurations` 时忽略。
- `supportedSizes: string[]` —— 声明的尺寸(WxH 和/或比例 token);`snapSizeToSupported` 命中则原样返回,否则按朝向映射(仅 `generic`)。
- `secondsFormat: 'string' | 'number'` —— `generic` 的 `seconds` 线上形态(Sora 在部分网关是字符串枚举;默认 `'number'`)。

## 视频模型字段能力对照(官方 / 网关 / OR)

本表对照三处来源的字段能力,作为接入与前端取值的依据:

- **官方** —— 各厂商官方 API 的真实能力(火山方舟 Ark / 阿里云百炼 DashScope / Google Veo / OpenAI Sora)。
- **网关** —— AIHubMix 网关(转发改写后)实际支持的能力。
- **OR** —— OpenRouter `GET /api/v1/videos/models` 公布的字段枚举。

网关将 OpenAI 风格请求重写为各厂商原生格式:通常官方能力最宽,网关因改写或未接而收窄,OR 为另一套抽象(可能与官方不一致)。本包字段取值**以官方为准、兼顾网关实际行为**。

图例:**✓** 本包已对齐;**⚠️** 存在差异或限制(见说明);`✗` 不支持。

### SeeDance 2.0 / 2.0 Fast

| 字段 | 官方 | 网关 | OR | 状态 |
|---|---|---|---|---|
| frames | first_frame + last_frame + reference_image (+ reference_video) | 同官方(`content[].role`) | first_frame, last_frame | ✓ 取官方全集(保留 `reference_image`) |
| resolution | 480p / 720p / 1080p | 由 size 短边推 480p/720p/1080p | 2.0:480/720/1080;Fast:480/720 | ✓ |
| 比例 | 16:9 / 9:16 / 1:1 … | 吸附表无 `9:21` | 含 `9:21` | ⚠️ `9:21` 仅 `ratio` 直传;走 size 会被 GCD 约分成 `3:7` |
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

## 用法

```ts
import { aihubmixMediaRegistry, buildVideoRequest } from '@aihubmix/media-adapters';

const cap = aihubmixMediaRegistry.get('aihubmix-happyhorse-1.0-i2v'); // 前缀会被去除
const built = buildVideoRequest(cap!, {
  prompt: 'a cat stretches',
  durationSeconds: 5,
  size: '1280x720',
  imageRef: { dataUrl }, // 调用方先把参考图解析为 data URL
});
// 传输由调用方完成:
// POST `${baseUrl}${built.pathSuffix}`,带鉴权头 + JSON.stringify(built.body)
```

本包**不做任何 I/O**:调用前先把参考图解析为 data URL,再用返回的 `{ pathSuffix, body }` 自行 fetch/轮询/下载。

## 脚本

- `pnpm build` —— tsup → `dist/{index.js,index.cjs,index.d.ts}`
- `pnpm test` —— vitest
- `pnpm typecheck` —— tsc --noEmit
