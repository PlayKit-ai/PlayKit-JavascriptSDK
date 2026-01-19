/**
 * Transcription provider for HTTP communication with audio transcription API
 */

import {
  TranscriptionConfig,
  TranscriptionResponse,
  PlayKitError,
  SDKConfig,
} from '../types';
import { AuthManager } from '../auth/AuthManager';
import { PlayerClient } from '../core/PlayerClient';

const DEFAULT_BASE_URL = 'https://playkit.ai';

export class TranscriptionProvider {
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
   * Convert audio data to base64 string
   */
  private audioToBase64(audio: string | Uint8Array | ArrayBuffer): string {
    if (typeof audio === 'string') {
      return audio;
    }

    const bytes = audio instanceof ArrayBuffer ? new Uint8Array(audio) : audio;

    // Check if we're in a browser environment
    if (typeof btoa !== 'undefined') {
      // Browser: use btoa
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    } else {
      // Node.js: use Buffer
      return Buffer.from(bytes).toString('base64');
    }
  }

  /**
   * Transcribe audio to text
   */
  async transcribe(transcriptionConfig: TranscriptionConfig): Promise<TranscriptionResponse> {
    // Ensure token is valid, auto-refresh if needed (browser mode only)
    await this.authManager.ensureValidToken();

    const token = this.authManager.getToken();
    if (!token) {
      throw new PlayKitError('Not authenticated', 'NOT_AUTHENTICATED');
    }

    const model = transcriptionConfig.model || this.config.defaultTranscriptionModel || 'whisper-large';
    const endpoint = `/ai/${this.config.gameId}/v2/audio/transcriptions`;

    const audioBase64 = this.audioToBase64(transcriptionConfig.audio);

    const requestBody: Record<string, unknown> = {
      model,
      audio: audioBase64,
    };

    // Add optional parameters
    if (transcriptionConfig.language) {
      requestBody.language = transcriptionConfig.language;
    }
    if (transcriptionConfig.prompt) {
      requestBody.prompt = transcriptionConfig.prompt;
    }
    if (transcriptionConfig.temperature !== undefined) {
      requestBody.temperature = transcriptionConfig.temperature;
    }

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Transcription failed' }));
        const playKitError = new PlayKitError(
          error.message || 'Transcription failed',
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

      const result = await response.json();

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
        'TRANSCRIPTION_ERROR'
      );
    }
  }
}
