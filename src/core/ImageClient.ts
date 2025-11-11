/**
 * Image generation client
 */

import { GeneratedImage, ImageGenerationConfig, ImageSize } from '../types';
import { ImageProvider } from '../providers/ImageProvider';

/**
 * Implementation of GeneratedImage interface
 */
class GeneratedImageImpl implements GeneratedImage {
  base64: string;
  originalPrompt: string;
  revisedPrompt?: string;
  generatedAt: number;
  size?: ImageSize;

  constructor(
    base64: string,
    originalPrompt: string,
    revisedPrompt?: string,
    size?: ImageSize
  ) {
    this.base64 = base64;
    this.originalPrompt = originalPrompt;
    this.revisedPrompt = revisedPrompt;
    this.generatedAt = Date.now();
    this.size = size;
  }

  toDataURL(): string {
    return `data:image/png;base64,${this.base64}`;
  }

  async toHTMLImage(): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error('Failed to load image'));
      img.src = this.toDataURL();
    });
  }
}

export class ImageClient {
  private provider: ImageProvider;
  private model: string;

  constructor(provider: ImageProvider, model?: string) {
    this.provider = provider;
    this.model = model || 'dall-e-3';
  }

  /**
   * Generate a single image
   */
  async generateImage(config: Omit<ImageGenerationConfig, 'n'>): Promise<GeneratedImage> {
    const imageConfig: ImageGenerationConfig = {
      ...config,
      model: config.model || this.model,
      n: 1,
    };

    const response = await this.provider.generateImages(imageConfig);

    const imageData = response.data[0];
    if (!imageData || !imageData.b64_json) {
      throw new Error('No image data in response');
    }

    return new GeneratedImageImpl(
      imageData.b64_json,
      config.prompt,
      imageData.revised_prompt,
      config.size
    );
  }

  /**
   * Generate multiple images
   */
  async generateImages(
    config: ImageGenerationConfig
  ): Promise<GeneratedImage[]> {
    const imageConfig: ImageGenerationConfig = {
      ...config,
      model: config.model || this.model,
      n: config.n || 1,
    };

    const response = await this.provider.generateImages(imageConfig);

    return response.data.map((imageData) => {
      if (!imageData.b64_json) {
        throw new Error('No image data in response');
      }

      return new GeneratedImageImpl(
        imageData.b64_json,
        config.prompt,
        imageData.revised_prompt,
        config.size
      );
    });
  }

  /**
   * Simple image generation with just a prompt
   */
  async generate(prompt: string, size?: ImageSize): Promise<GeneratedImage> {
    return this.generateImage({ prompt, size });
  }
}
