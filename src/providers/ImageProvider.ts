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

const DEFAULT_BASE_URL = 'https://playkit.agentlandlab.com';

export class ImageProvider {
  private authManager: AuthManager;
  private config: SDKConfig;
  private baseURL: string;

  constructor(authManager: AuthManager, config: SDKConfig) {
    this.authManager = authManager;
    this.config = config;
    this.baseURL = config.baseURL || DEFAULT_BASE_URL;
  }

  /**
   * Generate one or more images
   */
  async generateImages(imageConfig: ImageGenerationConfig): Promise<ImageGenerationResponse> {
    const token = this.authManager.getToken();
    if (!token) {
      throw new PlayKitError('Not authenticated', 'NOT_AUTHENTICATED');
    }

    const model = imageConfig.model || this.config.defaultImageModel || 'dall-e-3';
    const endpoint = `/ai/${this.config.gameId}/v1/image`;

    const requestBody = {
      model,
      prompt: imageConfig.prompt,
      n: imageConfig.n || 1,
      size: imageConfig.size || '1024x1024',
      seed: imageConfig.seed || null,
      quality: imageConfig.quality || 'standard',
      style: imageConfig.style || 'vivid',
      response_format: 'b64_json', // Always request base64
    };

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
        const error = await response.json().catch(() => ({ message: 'Image generation failed' }));
        throw new PlayKitError(
          error.message || 'Image generation failed',
          error.code,
          response.status
        );
      }

      return await response.json();
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
