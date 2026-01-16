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
 * Input image for img2img generation
 */
export interface ImageInput {
  /** Base64-encoded image data (without data URL prefix) */
  data: string;
  /** Optional media type (e.g., 'image/png', 'image/jpeg') */
  mediaType?: string;
}

/**
 * Configuration for image generation
 */
export interface ImageGenerationConfig {
  /** Text prompt for image generation (required for text-to-image, optional for img2img) */
  prompt?: string;

  /** Input images for img2img generation */
  images?: ImageInput[];

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

  /** If true, automatically remove background from generated images */
  transparent?: boolean;
}

/**
 * Generated image result
 */
export interface GeneratedImage {
  /** Base64-encoded image data (background removed if transparent=true and successful) */
  base64: string;

  /** Original prompt used */
  originalPrompt: string;

  /** Revised/enhanced prompt (if available) */
  revisedPrompt?: string;

  /** Timestamp of generation */
  generatedAt: number;

  /** Image size */
  size?: ImageSize;

  /** Original image before background removal (only present when transparent=true) */
  originalBase64?: string;

  /** Whether background removal was successful (only present when transparent=true) */
  transparentSuccess?: boolean;

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
    /** Original image before background removal (only present when transparent=true) */
    b64_json_original?: string;
    /** Whether background removal was successful (only present when transparent=true) */
    transparent_success?: boolean;
  }>;
}
