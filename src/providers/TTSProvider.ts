/**
 * TTS provider for HTTP communication with the text-to-speech API
 */

import {
  TTSConfig,
  TTSResult,
  TTSTimestampsConfig,
  TTSTimestampsResult,
  Alignment,
  PlayKitError,
  SDKConfig,
} from '../types';
import { AuthManager } from '../auth/AuthManager';
import { PlayerClient } from '../core/PlayerClient';
import { getSDKHeaders } from '../utils/sdkHeaders';

// @ts-ignore - replaced at build time
const DEFAULT_BASE_URL = __PLAYKIT_BASE_URL__;

/** Decode a base64 string to an ArrayBuffer (browser + Node). */
function base64ToArrayBuffer(b64: string): ArrayBuffer {
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer as ArrayBuffer;
  }
  // Node fallback
  const buf = (globalThis as any).Buffer.from(b64, 'base64') as Uint8Array;
  return buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength
  ) as ArrayBuffer;
}

export class TTSProvider {
  private authManager: AuthManager;
  private config: SDKConfig;
  private baseURL: string;
  private playerClient?: PlayerClient;

  constructor(authManager: AuthManager, config: SDKConfig) {
    this.authManager = authManager;
    this.config = config;
    this.baseURL = config.baseURL || DEFAULT_BASE_URL;
  }

  /**
   * Set player client for balance checking
   */
  setPlayerClient(playerClient: PlayerClient): void {
    this.playerClient = playerClient;
  }

  /** Build the shared request body from a TTS config (new fields + legacy). */
  private buildRequestBody(ttsConfig: TTSConfig): Record<string, unknown> {
    const model =
      ttsConfig.model || this.config.defaultTTSModel || 'default-tts-model';
    const body: Record<string, unknown> = { model, text: ttsConfig.text };

    if (ttsConfig.voice !== undefined) body.voice = ttsConfig.voice;
    if (ttsConfig.voiceMix !== undefined) body.voice_mix = ttsConfig.voiceMix;
    if (ttsConfig.voiceSettings !== undefined) {
      body.voice_settings = ttsConfig.voiceSettings;
    }
    if (ttsConfig.outputFormat !== undefined) {
      body.output_format = ttsConfig.outputFormat;
    }
    if (ttsConfig.language !== undefined) body.language = ttsConfig.language;
    if (ttsConfig.providerOptions !== undefined) {
      body.provider_options = ttsConfig.providerOptions;
    }

    return body;
  }

  /** POST to a TTS endpoint; throws a PlayKitError on a non-ok response. */
  private async post(endpoint: string, body: unknown): Promise<Response> {
    await this.authManager.ensureValidToken();
    const token = this.authManager.getToken();
    if (!token) {
      throw new PlayKitError('Not authenticated', 'NOT_AUTHENTICATED');
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...getSDKHeaders(),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: 'Speech synthesis failed' }));
      const playKitError = new PlayKitError(
        error.message || 'Speech synthesis failed',
        error.code,
        response.status
      );
      if (
        error.code === 'INSUFFICIENT_CREDITS' ||
        error.code === 'PLAYER_INSUFFICIENT_CREDIT' ||
        response.status === 402
      ) {
        if (this.playerClient) {
          await this.playerClient.handleInsufficientCredits(playKitError);
        }
      }
      throw playKitError;
    }

    return response;
  }

  private checkBalanceAfter(): void {
    if (this.playerClient) {
      this.playerClient.checkBalanceAfterApiCall().catch(() => {
        /* silently fail */
      });
    }
  }

  /**
   * Synthesize text into speech audio (raw bytes).
   */
  async synthesize(ttsConfig: TTSConfig): Promise<TTSResult> {
    const endpoint = `/ai/${this.config.gameId}/v2/audio/speech`;
    try {
      const response = await this.post(endpoint, this.buildRequestBody(ttsConfig));

      // SUCCESS: response is raw audio bytes, NOT JSON.
      const audio = await response.arrayBuffer();
      const contentType = response.headers.get('Content-Type');
      const usageHeader = response.headers.get('X-Usage-Characters');
      const audioLengthHeader = response.headers.get('X-Audio-Length-Ms');

      const result: TTSResult = {
        audio,
        format: contentType || 'mp3',
        usageCharacters: Number(usageHeader) || 0,
      };
      if (audioLengthHeader !== null) {
        result.audioLengthMs = Number(audioLengthHeader) || 0;
      }

      this.checkBalanceAfter();
      return result;
    } catch (error) {
      if (error instanceof PlayKitError) throw error;
      throw new PlayKitError(
        error instanceof Error ? error.message : 'Unknown error',
        'TTS_ERROR'
      );
    }
  }

  /**
   * Synthesize text into speech AND return timestamp alignment. Hits the
   * `speech-with-timestamps` variant, whose success response is a JSON envelope
   * (base64 audio + alignment), so it is parsed as JSON — not raw bytes.
   */
  async synthesizeWithTimestamps(
    ttsConfig: TTSTimestampsConfig
  ): Promise<TTSTimestampsResult> {
    const endpoint = `/ai/${this.config.gameId}/v2/audio/speech-with-timestamps`;
    const body = this.buildRequestBody(ttsConfig);
    if (ttsConfig.granularity !== undefined) {
      body.subtitle_type = ttsConfig.granularity;
    }

    try {
      const response = await this.post(endpoint, body);
      const json = (await response.json()) as {
        audio_base64: string;
        format?: string;
        usage_characters?: number;
        audio_length_ms?: number | null;
        alignment?: {
          granularity?: string;
          items?: Array<{
            text?: string;
            start_ms?: number;
            end_ms?: number;
            text_start?: number;
            text_end?: number;
          }>;
        } | null;
      };

      let alignment: Alignment | null = null;
      if (json.alignment && Array.isArray(json.alignment.items)) {
        alignment = {
          granularity: json.alignment.granularity || 'word',
          items: json.alignment.items.map((it) => ({
            text: it.text ?? '',
            startMs: it.start_ms ?? 0,
            endMs: it.end_ms ?? 0,
            textStart: it.text_start,
            textEnd: it.text_end,
          })),
        };
      }

      const result: TTSTimestampsResult = {
        audio: base64ToArrayBuffer(json.audio_base64),
        format: json.format || 'mp3',
        usageCharacters: Number(json.usage_characters) || 0,
        alignment,
      };
      if (json.audio_length_ms != null) {
        result.audioLengthMs = Number(json.audio_length_ms) || 0;
      }

      this.checkBalanceAfter();
      return result;
    } catch (error) {
      if (error instanceof PlayKitError) throw error;
      throw new PlayKitError(
        error instanceof Error ? error.message : 'Unknown error',
        'TTS_ERROR'
      );
    }
  }
}
