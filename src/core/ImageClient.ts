/**
 * Image generation client
 */

import { GeneratedImage, ImageGenerationConfig, ImageSize, ImageInput } from '../types';
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
  originalBase64?: string;
  transparentSuccess?: boolean;

  constructor(
    base64: string,
    originalPrompt: string,
    revisedPrompt?: string,
    size?: ImageSize,
    originalBase64?: string,
    transparentSuccess?: boolean
  ) {
    this.base64 = base64;
    this.originalPrompt = originalPrompt;
    this.revisedPrompt = revisedPrompt;
    this.generatedAt = Date.now();
    this.size = size;
    this.originalBase64 = originalBase64;
    this.transparentSuccess = transparentSuccess;
  }

  toDataURL(): string {
    return `data:image/png;base64,${this.base64}`;
  }

  async toHTMLImage(): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (_e) => reject(new Error('Failed to load image'));
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
      imageData.revised_prompt ?? config.prompt,
      config.size,
      imageData.b64_json_original,
      imageData.transparent_success
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
        imageData.revised_prompt ?? config.prompt,
        config.size,
        imageData.b64_json_original,
        imageData.transparent_success
      );
    });
  }

  /**
   * Simple image generation with just a prompt
   */
  async generate(prompt: string, size?: ImageSize): Promise<GeneratedImage> {
    return this.generateImage({ prompt, size });
  }

  /**
   * Image-to-image generation
   * @param images - Input images (base64 encoded)
   * @param prompt - Optional prompt to guide the generation
   * @param options - Additional generation options
   */
  async img2img(
    images: ImageInput[],
    prompt?: string,
    options?: Omit<ImageGenerationConfig, 'images' | 'prompt' | 'n'>
  ): Promise<GeneratedImage> {
    return this.generateImage({
      images,
      prompt,
      ...options,
    });
  }

  /**
   * Convert a data URL to ImageInput format
   * @param dataUrl - Data URL (e.g., 'data:image/png;base64,...')
   */
  static dataUrlToImageInput(dataUrl: string): ImageInput {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new Error('Invalid data URL format');
    }
    return {
      mediaType: match[1],
      data: match[2],
    };
  }

  /**
   * Convert a File/Blob to ImageInput format (browser only)
   * @param file - File or Blob object
   */
  static async fileToImageInput(file: Blob): Promise<ImageInput> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(ImageClient.dataUrlToImageInput(result));
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }
}
