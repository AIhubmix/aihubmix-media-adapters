// Audio (TTS) capability/request contract — PLACEHOLDER (adapter not implemented yet).
//
// AIHubMix speech is the OpenAI POST /v1/audio/speech shape for most models, and
// a Gemini generateContent shape (responseModalities:['AUDIO'] + speechConfig,
// returns raw PCM → the caller wraps WAV) for gemini-*-tts. The request mapping
// currently lives inline in open-design's byok-tools.ts
// (executeAIHubMixGenerateSpeech); it will be ported into adapters/audio.ts in a
// fast follow. Types defined now so the 3-media-type contract is real.

export interface SpeechBuildInput {
  text: string;
  voice?: string;
  format?: string;
  passthrough?: Record<string, unknown>;
}

export interface BuiltSpeechRequest {
  wireModel: string;
  pathSuffix: string;
  contentType: string;
  body: Record<string, unknown>;
  /** True for the Gemini-native generateContent path (returns PCM → wrap WAV). */
  geminiNative?: boolean;
}
