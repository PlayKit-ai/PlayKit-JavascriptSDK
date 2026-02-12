/**
 * Image generation provider for HTTP communication with image API
 */

import {
  ImageGenerationConfig,
  ImageGenerationResponse,
  PlayKitError,
  SDKConfig,
} from '../types';
import { AuthManager } from '../auth/AuthManager';
import { PlayerClient } from '../core/PlayerClient';
import { getSDKHeaders } from '../utils/sdkHeaders';

const DEFAULT_BASE_URL = 'https://playkit.ai';

export class ImageProvider {
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
   * Generate one or more images
   */
  async generateImages(imageConfig: ImageGenerationConfig): Promise<ImageGenerationResponse> {
    // Ensure token is valid, auto-refresh if needed (browser mode only)
    await this.authManager.ensureValidToken();

    const token = this.authManager.getToken();
    if (!token) {
      throw new PlayKitError('Not authenticated', 'NOT_AUTHENTICATED');
    }

    const model = imageConfig.model || this.config.defaultImageModel || 'dall-e-3';
    const endpoint = `/ai/${this.config.gameId}/v2/image`;

    const requestBody: any = {
      model,
      n: imageConfig.n || 1,
      size: imageConfig.size || '1024x1024',
      seed: imageConfig.seed || null,
    };

    // Add prompt if provided
    if (imageConfig.prompt) {
      requestBody.prompt = imageConfig.prompt;
    }

    // Add input images for img2img
    if (imageConfig.images && imageConfig.images.length > 0) {
      requestBody.images = imageConfig.images.map(img => img.data);
    }

    // Add optional quality and style if provided (for DALL-E models)
    if (imageConfig.quality) {
      requestBody.quality = imageConfig.quality;
    }
    if (imageConfig.style) {
      requestBody.style = imageConfig.style;
    }
    // Add transparent option for background removal
    if (imageConfig.transparent) {
      requestBody.transparent = true;
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
        const error = await response.json().catch(() => ({ message: 'Image generation failed' }));
        const playKitError = new PlayKitError(
          error.message || 'Image generation failed',
          error.code,
          response.status
        );

        // Check for insufficient credits error
        if (error.code === 'INSUFFICIENT_CREDITS' || response.status === 402) {
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
        'IMAGE_GENERATION_ERROR'
      );
    }
  }
}
