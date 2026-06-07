/**
 * Text-to-speech (TTS) type definitions
 */

/** One voice in a `voiceMix` blend. */
export interface VoiceMixEntry {
  /** Voice id to include in the blend. */
  voice: string;
  /** Relative weight, integer 1–100. */
  weight: number;
}

/** Neutral voice tuning knobs (ElevenLabs-style nested object). */
export interface VoiceSettings {
  /** Playback speed multiplier (0.5–2). */
  speed?: number;
  /** Volume (0–10). */
  volume?: number;
  /** Pitch adjustment (-12–12). */
  pitch?: number;
  /** Emotion, e.g. 'happy' | 'sad' | 'calm'. */
  emotion?: string;
}

/**
 * Configuration for text-to-speech requests.
 *
 * Inline markup in `text` is supported: pause via `[pause 1.5s]` or
 * `<break time="1.5s"/>`, and interjections via `[laughs]` / `[breath]` (on
 * models that support them). These are translated server-side.
 */
export interface TTSConfig {
  /** Text to synthesize into speech (max 10000 characters). */
  text: string;

  /**
   * Model to use for synthesis.
   * Defaults to 'default-tts-model' (alias resolved by the backend).
   */
  model?: string;

  /** Voice id to use (e.g., 'male-qn-qingse'). Mutually exclusive with `voiceMix`. */
  voice?: string;

  /**
   * Blend multiple voices (1–4 entries, weights 1–100). Mutually exclusive with
   * `voice`.
   */
  voiceMix?: VoiceMixEntry[];

  /** Neutral voice tuning (speed/volume/pitch/emotion). */
  voiceSettings?: VoiceSettings;

  /**
   * Output audio format, ElevenLabs-style: `{codec}_{sampleRate}_{bitrateKbps}`.
   * Examples: 'mp3', 'mp3_44100_128', 'pcm_24000', 'wav', 'flac_44100', 'opus'.
   */
  outputFormat?: string;

  /** Language hint to improve pronunciation, e.g. 'Chinese' | 'English' | 'auto'. */
  language?: string;

  /**
   * Escape hatch for advanced provider-specific fields not modeled above
   * (e.g. voice effects, pronunciation dictionaries).
   */
  providerOptions?: Record<string, unknown>;
}

/**
 * Options for simplified text-to-speech methods (everything except the text)
 */
export type TTSOptions = Omit<TTSConfig, 'text'>;

/** Config for `synthesizeWithTimestamps`: adds subtitle granularity. */
export interface TTSTimestampsConfig extends TTSConfig {
  /** Timestamp granularity; defaults to 'word'. */
  granularity?: 'sentence' | 'word';
}

/**
 * Result of a text-to-speech request
 */
export interface TTSResult {
  /** Raw audio bytes. */
  audio: ArrayBuffer;

  /** Audio format / content type (e.g., 'audio/mpeg' or 'mp3'). */
  format: string;

  /** Number of characters billed for this request. */
  usageCharacters: number;

  /** Length of the generated audio in milliseconds (if reported). */
  audioLengthMs?: number;
}

/** One timed unit (word or sentence) in an {@link Alignment}. */
export interface AlignmentItem {
  /** The spoken text of this unit. */
  text: string;
  /** Start time in milliseconds. */
  startMs: number;
  /** End time in milliseconds. */
  endMs: number;
  /** Character offset of this unit's start in the input text (if reported). */
  textStart?: number;
  /** Character offset of this unit's end in the input text (if reported). */
  textEnd?: number;
}

/** Timestamp alignment for synthesized speech. */
export interface Alignment {
  /** 'word' | 'sentence' — the granularity of `items`. */
  granularity: string;
  /** Timed units in order. */
  items: AlignmentItem[];
}

/** Result of `synthesizeWithTimestamps`: audio plus timestamp alignment. */
export interface TTSTimestampsResult extends TTSResult {
  /** Word/sentence timings, or null if unavailable. */
  alignment: Alignment | null;
}
