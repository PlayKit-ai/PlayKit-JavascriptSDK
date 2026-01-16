/**
 * High-level client for audio transcription
 */

import {
  TranscriptionConfig,
  TranscriptionOptions,
  TranscriptionResult,
} from '../types';
import { TranscriptionProvider } from '../providers/TranscriptionProvider';

export class TranscriptionClient {
  private provider: TranscriptionProvider;
  private model: string;

  constructor(provider: TranscriptionProvider, model?: string) {
    this.provider = provider;
    this.model = model || 'whisper-large';
  }

  /**
   * Get the current model name
   */
  get modelName(): string {
    return this.model;
  }

  /**
   * Transcribe audio with full configuration
   * @param config - Full transcription configuration
   * @returns Transcription result
   */
  async transcribe(config: TranscriptionConfig): Promise<TranscriptionResult> {
    const response = await this.provider.transcribe({
      ...config,
      model: config.model || this.model,
    });

    return {
      text: response.text,
      language: response.language,
      durationInSeconds: response.durationInSeconds,
      segments: response.segments,
    };
  }

  /**
   * Transcribe raw audio data (Uint8Array or ArrayBuffer)
   * @param audioData - Raw audio bytes
   * @param options - Optional transcription settings
   * @returns Transcription result
   */
  async transcribeAudio(
    audioData: Uint8Array | ArrayBuffer,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    return this.transcribe({
      audio: audioData,
      model: this.model,
      ...options,
    });
  }

  /**
   * Transcribe audio from a base64 string
   * @param base64Audio - Base64-encoded audio data
   * @param options - Optional transcription settings
   * @returns Transcription result
   */
  async transcribeBase64(
    base64Audio: string,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    return this.transcribe({
      audio: base64Audio,
      model: this.model,
      ...options,
    });
  }

  /**
   * Transcribe audio from a Blob (browser only)
   * @param blob - Audio blob
   * @param options - Optional transcription settings
   * @returns Transcription result
   */
  async transcribeBlob(
    blob: Blob,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    const arrayBuffer = await blob.arrayBuffer();
    return this.transcribeAudio(new Uint8Array(arrayBuffer), options);
  }

  /**
   * Transcribe audio from a File (browser only)
   * @param file - Audio file
   * @param options - Optional transcription settings
   * @returns Transcription result
   */
  async transcribeFile(
    file: File,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    const arrayBuffer = await file.arrayBuffer();
    return this.transcribeAudio(new Uint8Array(arrayBuffer), options);
  }
}
