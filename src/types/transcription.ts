/**
 * Audio transcription type definitions
 */

/**
 * Configuration for transcription requests
 */
export interface TranscriptionConfig {
  /**
   * Audio data as base64 string, Uint8Array, or ArrayBuffer
   */
  audio: string | Uint8Array | ArrayBuffer;

  /**
   * Model to use for transcription (e.g., 'whisper-large')
   */
  model?: string;

  /**
   * Language of the audio (ISO 639-1 code, e.g., 'en', 'zh')
   * If not provided, the model will auto-detect
   */
  language?: string;

  /**
   * Optional prompt to guide the transcription style
   */
  prompt?: string;

  /**
   * Sampling temperature (0-1). Lower values are more deterministic.
   */
  temperature?: number;
}

/**
 * Options for simplified transcription methods
 */
export interface TranscriptionOptions {
  /**
   * Language of the audio (ISO 639-1 code)
   */
  language?: string;

  /**
   * Optional prompt to guide transcription
   */
  prompt?: string;

  /**
   * Sampling temperature (0-1)
   */
  temperature?: number;
}

/**
 * A segment of transcribed audio with timing information
 */
export interface TranscriptionSegment {
  /**
   * Start time in seconds
   */
  start: number;

  /**
   * End time in seconds
   */
  end: number;

  /**
   * Transcribed text for this segment
   */
  text: string;
}

/**
 * Result of a transcription request
 */
export interface TranscriptionResult {
  /**
   * Full transcribed text
   */
  text: string;

  /**
   * Detected or specified language
   */
  language?: string;

  /**
   * Duration of the audio in seconds
   */
  durationInSeconds?: number;

  /**
   * Detailed segments with timing (if available)
   */
  segments?: TranscriptionSegment[];
}

/**
 * Internal request format for the transcription API
 */
export interface TranscriptionRequest {
  model: string;
  audio: string; // base64
  language?: string;
  prompt?: string;
  temperature?: number;
}

/**
 * Raw API response from transcription endpoint
 */
export interface TranscriptionResponse {
  text: string;
  language?: string;
  durationInSeconds?: number;
  segments?: TranscriptionSegment[];
}
