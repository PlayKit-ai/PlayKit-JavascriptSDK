/**
 * Server-Sent Events (SSE) stream parser
 * Handles parsing of streaming text responses
 */

import { textDecode } from './CryptoUtils';

/**
 * Create a cross-platform text decoder
 */
function createDecoder(): { decode: (data: Uint8Array, options?: { stream?: boolean }) => string } {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder();
  }
  // Fallback for environments without TextDecoder
  return {
    decode: (data: Uint8Array, _options?: { stream?: boolean }) => textDecode(data),
  };
}

export class StreamParser {
  /**
   * Parse SSE stream using ReadableStream
   */
  static async *parseStream(
    reader: ReadableStreamDefaultReader<Uint8Array>
  ): AsyncGenerator<string, void, unknown> {
    const decoder = createDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Split by newlines to process complete messages
        const lines = buffer.split('\n');

        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();

          if (!trimmed || trimmed.startsWith(':')) {
            // Empty line or comment, skip
            continue;
          }

          if (trimmed === 'data: [DONE]') {
            // End of stream
            return;
          }

          if (trimmed.startsWith('data: ')) {
            const data = trimmed.substring(6); // Remove 'data: ' prefix

            try {
              const parsed = JSON.parse(data);
              const text = this.extractTextFromChunk(parsed);

              if (text) {
                yield text;
              }

              if (parsed.type === 'done' || parsed.finish_reason) {
                return;
              }
            } catch (error) {
              // If JSON parse fails, treat as plain text
              yield data;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Extract text from a stream chunk
   * Supports multiple formats (UI Message Stream and OpenAI)
   */
  private static extractTextFromChunk(chunk: any): string | null {
    // UI Message Stream format: { type: "text-delta", delta: "..." }
    if (chunk.type === 'text-delta' && chunk.delta) {
      return chunk.delta;
    }

    // OpenAI format: { choices: [{ delta: { content: "..." } }] }
    if (chunk.choices && chunk.choices[0]?.delta?.content) {
      return chunk.choices[0].delta.content;
    }

    // Direct delta format
    if (chunk.delta) {
      return typeof chunk.delta === 'string' ? chunk.delta : chunk.delta.content || null;
    }

    return null;
  }

  /**
   * Collect all chunks from a stream
   */
  static async collectFullText(
    reader: ReadableStreamDefaultReader<Uint8Array>
  ): Promise<string> {
    let fullText = '';

    for await (const chunk of this.parseStream(reader)) {
      fullText += chunk;
    }

    return fullText;
  }

  /**
   * Stream with callbacks
   */
  static async streamWithCallbacks(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    onChunk: (chunk: string) => void,
    onComplete?: (fullText: string) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    let fullText = '';

    try {
      for await (const chunk of this.parseStream(reader)) {
        fullText += chunk;
        onChunk(chunk);
      }

      if (onComplete) {
        onComplete(fullText);
      }
    } catch (error) {
      if (onError && error instanceof Error) {
        onError(error);
      } else {
        throw error;
      }
    }
  }
}
