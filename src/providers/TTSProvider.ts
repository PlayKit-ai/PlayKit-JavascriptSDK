/**
 * TTS provider for HTTP communication with the text-to-speech API
 */

import {
  TTSConfig,
  TTSResult,
  PlayKitError,
  SDKConfig,
} from '../types';
import { AuthManager } from '../auth/AuthManager';
import { PlayerClient } from '../core/PlayerClient';
import { getSDKHeaders } from '../utils/sdkHeaders';

// @ts-ignore - replaced at build time
const DEFAULT_BASE_URL = __PLAYKIT_BASE_URL__;

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

  /**
   * Synthesize text into speech audio
   */
  async synthesize(ttsConfig: TTSConfig): Promise<TTSResult> {
    // Ensure token is valid, auto-refresh if needed (browser mode only)
    await this.authManager.ensureValidToken();

    const token = this.authManager.getToken();
    if (!token) {
      throw new PlayKitError('Not authenticated', 'NOT_AUTHENTICATED');
    }

    const model = ttsConfig.model || this.config.defaultTTSModel || 'default-tts-model';
    const endpoint = `/ai/${this.config.gameId}/v2/audio/speech`;

    const requestBody: Record<string, unknown> = {
      model,
      text: ttsConfig.text,
    };

    // Add optional parameters (only when defined)
    if (ttsConfig.voice !== undefined) {
      requestBody.voice = ttsConfig.voice;
    }
    if (ttsConfig.speed !== undefined) {
      requestBody.speed = ttsConfig.speed;
    }
    if (ttsConfig.vol !== undefined) {
      requestBody.vol = ttsConfig.vol;
    }
    if (ttsConfig.pitch !== undefined) {
      requestBody.pitch = ttsConfig.pitch;
    }
    if (ttsConfig.emotion !== undefined) {
      requestBody.emotion = ttsConfig.emotion;
    }
    if (ttsConfig.languageBoost !== undefined) {
      requestBody.language_boost = ttsConfig.languageBoost;
    }
    if (ttsConfig.format !== undefined) {
      requestBody.response_format = ttsConfig.format;
    }
    if (ttsConfig.voiceSetting !== undefined) {
      requestBody.voice_setting = ttsConfig.voiceSetting;
    }
    if (ttsConfig.audioSetting !== undefined) {
      requestBody.audio_setting = ttsConfig.audioSetting;
    }

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...getSDKHeaders(),
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Speech synthesis failed' }));
        const playKitError = new PlayKitError(
          error.message || 'Speech synthesis failed',
          error.code,
          response.status
        );

        // Check for insufficient credits error
        if (error.code === 'INSUFFICIENT_CREDITS' ||
            error.code === 'PLAYER_INSUFFICIENT_CREDIT' ||
            response.status === 402) {
          if (this.playerClient) {
            await this.playerClient.handleInsufficientCredits(playKitError);
          }
        }

        throw playKitError;
      }

      // SUCCESS: response is raw audio bytes, NOT JSON.
      const audio = await response.arrayBuffer();
      const contentType = response.headers.get('Content-Type');
      const usageHeader = response.headers.get('X-Usage-Characters');
      const audioLengthHeader = response.headers.get('X-Audio-Length-Ms');

      const result: TTSResult = {
        audio,
        format: contentType || ttsConfig.format || 'mp3',
        usageCharacters: Number(usageHeader) || 0,
      };

      if (audioLengthHeader !== null) {
        result.audioLengthMs = Number(audioLengthHeader) || 0;
      }

      // Check balance after successful API call
      if (this.playerClient) {
        this.playerClient.checkBalanceAfterApiCall().catch(() => {
          // Silently fail
        });
      }

      return result;
    } catch (error) {
      if (error instanceof PlayKitError) {
        throw error;
      }
      throw new PlayKitError(
        error instanceof Error ? error.message : 'Unknown error',
        'TTS_ERROR'
      );
    }
  }
}
