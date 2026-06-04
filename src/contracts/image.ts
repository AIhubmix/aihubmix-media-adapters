// Image capability/request contract — PLACEHOLDER (adapter not implemented yet).
//
// AIHubMix image generation varies by `requestMode`:
//   • predictions — POST /v1/models/{apiModel}/predictions (most: gemini, imagen, qwen, doubao, flux, ideogram)
//   • images      — POST /v1/images/generations (OpenAI gpt-image / dall-e shape)
//   • edits       — POST /v1/images/edits (multipart; qwen-image-edit)
// plus a gemini-native generateContent shape (responseModalities:['TEXT','IMAGE']).
// The request mapping currently lives inline in open-design's byok-tools.ts
// (executeAIHubMixGenerateImage); it will be ported into adapters/image.ts in a
// fast follow. The contract types are defined now so the 3-media-type shape is real.

export type ImageRequestMode = 'predictions' | 'images' | 'edits';

export interface ImageBuildInput {
  prompt: string;
  size?: string;
  n?: number;
  /** Reference images for i2i / edit, as data URLs. */
  imageRefs?: Array<{ dataUrl: string }>;
  passthrough?: Record<string, unknown>;
}

export interface BuiltImageRequest {
  wireModel: string;
  pathSuffix: string;
  contentType: string;
  body: Record<string, unknown>;
}
