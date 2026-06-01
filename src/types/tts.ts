/**
 * Text-to-speech (TTS) type definitions
 */

/**
 * Configuration for text-to-speech requests
 */
export interface TTSConfig {
  /**
   * Text to synthesize into speech (max 10000 characters)
   */
  text: string;

  /**
   * Model to use for synthesis
   * Defaults to 'default-tts-model' (alias resolved by the backend)
   */
  model?: string;

  /**
   * Voice id to use (e.g., 'male-qn-qingse')
   */
  voice?: string;

  /**
   * Playback speed multiplier
   */
  speed?: number;

  /**
   * Volume
   */
  vol?: number;

  /**
   * Pitch adjustment
   */
  pitch?: number;

  /**
   * Emotion of the speech (e.g., 'happy', 'sad')
   */
  emotion?: string;

  /**
   * Output audio format (e.g., 'mp3', 'wav')
   */
  format?: string;

  /**
   * Language boost hint to improve pronunciation for a specific language
   */
  languageBoost?: string;

  /**
   * Passthrough voice settings object for advanced configuration
   */
  voiceSetting?: Record<string, unknown>;

  /**
   * Passthrough audio settings object for advanced configuration
   */
  audioSetting?: Record<string, unknown>;
}

/**
 * Options for simplified text-to-speech methods (everything except the text)
 */
export type TTSOptions = Omit<TTSConfig, 'text'>;

/**
 * Result of a text-to-speech request
 */
export interface TTSResult {
  /**
   * Raw audio bytes
   */
  audio: ArrayBuffer;

  /**
   * Audio format / content type (e.g., 'audio/mpeg' or 'mp3')
   */
  format: string;

  /**
   * Number of characters billed for this request
   */
  usageCharacters: number;

  /**
   * Length of the generated audio in milliseconds (if reported)
   */
  audioLengthMs?: number;
}
