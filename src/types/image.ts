/**
 * Image generation types
 */

/**
 * Supported image sizes
 */
export type ImageSize =
  | '256x256'
  | '512x512'
  | '1024x1024'
  | '1792x1024'
  | '1024x1792';

/**
 * Configuration for image generation
 */
export interface ImageGenerationConfig {
  /** Text prompt for image generation */
  prompt: string;

  /** Image size */
  size?: ImageSize;

  /** Number of images to generate (1-10) */
  n?: number;

  /** Random seed for reproducible results */
  seed?: number;

  /** Model to use */
  model?: string;

  /** Quality setting (standard or hd) */
  quality?: 'standard' | 'hd';

  /** Style setting (vivid or natural) */
  style?: 'vivid' | 'natural';
}

/**
 * Generated image result
 */
export interface GeneratedImage {
  /** Base64-encoded image data */
  base64: string;

  /** Original prompt used */
  originalPrompt: string;

  /** Revised/enhanced prompt (if available) */
  revisedPrompt?: string;

  /** Timestamp of generation */
  generatedAt: number;

  /** Image size */
  size?: ImageSize;

  /** Converts base64 to data URL */
  toDataURL(): string;

  /** Converts to HTMLImageElement (browser only) */
  toHTMLImage(): Promise<HTMLImageElement>;
}

/**
 * OpenAI-compatible image generation response
 */
export interface ImageGenerationResponse {
  created: number;
  data: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
  }>;
}
