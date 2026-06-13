/**
 * High-level client for text-to-speech synthesis
 */

import {
  TTSConfig,
  TTSResult,
  TTSTimestampsConfig,
  TTSTimestampsResult,
  VoiceListResult,
  PlayKitError,
} from '../types';
import { TTSProvider } from '../providers/TTSProvider';

/**
 * Resolve an audio format/content-type string into a valid MIME type.
 * The provider's `result.format` may be a full MIME (e.g. 'audio/mpeg' from
 * the Content-Type header) or a bare token (e.g. 'mp3' from the fallback).
 * Full MIME strings pass through; bare tokens are mapped.
 */
function contentTypeFor(format: string): string {
  if (format.includes('/')) {
    return format;
  }
  switch (format.toLowerCase()) {
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
      return 'audio/ogg';
    case 'flac':
      return 'audio/flac';
    case 'aac':
      return 'audio/aac';
    case 'pcm':
      return 'audio/pcm';
    default:
      return 'audio/mpeg';
  }
}

export class TTSClient {
  private provider: TTSProvider;
  private model: string;

  constructor(provider: TTSProvider, model?: string) {
    this.provider = provider;
    this.model = model || 'default-tts-model';
  }

  /**
   * Get the current model name
   */
  get modelName(): string {
    return this.model;
  }

  /**
   * Synthesize text into speech audio
   * @param config - Full TTS configuration
   * @returns TTS result containing raw audio bytes and usage metadata
   */
  async synthesize(config: TTSConfig): Promise<TTSResult> {
    return this.provider.synthesize({
      ...config,
      model: config.model || this.model,
    });
  }

  /**
   * Synthesize text into speech AND return timestamp alignment (word/sentence
   * timings). Returns the audio bytes plus an `alignment` object.
   * @param config - TTS configuration; `granularity` defaults to 'word'.
   */
  async synthesizeWithTimestamps(
    config: TTSTimestampsConfig
  ): Promise<TTSTimestampsResult> {
    return this.provider.synthesizeWithTimestamps({
      ...config,
      model: config.model || this.model,
    });
  }

  /**
   * List the voices available for speech synthesis
   * @returns The available voices and a total count
   */
  async listVoices(): Promise<VoiceListResult> {
    return this.provider.listVoices();
  }

  /**
   * Synthesize text into speech and return it as a Blob (browser-friendly)
   * @param config - Full TTS configuration
   * @returns Audio Blob with the appropriate MIME type
   */
  async synthesizeToBlob(config: TTSConfig): Promise<Blob> {
    const result = await this.synthesize(config);
    return new Blob([result.audio], { type: contentTypeFor(result.format) });
  }

  /**
   * Synthesize text into speech and return an object URL (browser only)
   * @param config - Full TTS configuration
   * @returns An object URL that can be assigned to an <audio> element
   * @throws PlayKitError if URL.createObjectURL is unavailable (e.g. Node.js)
   */
  async synthesizeToObjectURL(config: TTSConfig): Promise<string> {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      throw new PlayKitError(
        'URL.createObjectURL is not available in this environment. ' +
          'Use synthesize() to access the raw audio bytes instead.',
        'TTS_OBJECT_URL_UNAVAILABLE'
      );
    }
    const blob = await this.synthesizeToBlob(config);
    return URL.createObjectURL(blob);
  }
}
