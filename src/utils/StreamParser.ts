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

/**
 * A parsed part of the stream — either generated text or reasoning (thinking) text.
 */
export interface StreamPart {
  kind: 'text' | 'reasoning';
  delta: string;
}

export class StreamParser {
  /**
   * Parse SSE stream using ReadableStream
   * Yields typed parts so callers can separate text from reasoning.
   */
  static async *parseStream(
    reader: ReadableStreamDefaultReader<Uint8Array>
  ): AsyncGenerator<StreamPart, void, unknown> {
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
              const part = this.extractPartFromChunk(parsed);

              if (part) {
                yield part;
              }

              // Stream termination events
              if (parsed.type === 'done' || parsed.type === 'finish' || parsed.finish_reason) {
                return;
              }

              if (parsed.type === 'abort') {
                // Server-side timeout or cancellation — treat as end of stream
                return;
              }

              if (parsed.type === 'error') {
                // Server-side error event — throw to trigger onError callback
                throw new Error(parsed.errorText || parsed.error || 'Stream error');
              }
            } catch (error) {
              // If JSON parse fails, treat as plain text
              yield { kind: 'text', delta: data };
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Extract a typed part (text or reasoning) from a stream chunk
   * Supports multiple formats (UI Message Stream and OpenAI).
   * Reasoning is detected before the generic text fallback so thinking
   * deltas never leak into the text stream.
   */
  private static extractPartFromChunk(chunk: any): StreamPart | null {
    // UI Message Stream reasoning: { type: "reasoning-delta", delta: "..." }
    if (chunk.type === 'reasoning-delta' && chunk.delta) {
      return { kind: 'reasoning', delta: chunk.delta };
    }

    // UI Message Stream text: { type: "text-delta", delta: "..." }
    if (chunk.type === 'text-delta' && chunk.delta) {
      return { kind: 'text', delta: chunk.delta };
    }

    // OpenAI reasoning (defensive): { choices: [{ delta: { reasoning_content: "..." } }] }
    if (chunk.choices && chunk.choices[0]?.delta?.reasoning_content) {
      return { kind: 'reasoning', delta: chunk.choices[0].delta.reasoning_content };
    }

    // OpenAI text: { choices: [{ delta: { content: "..." } }] }
    if (chunk.choices && chunk.choices[0]?.delta?.content) {
      return { kind: 'text', delta: chunk.choices[0].delta.content };
    }

    // Direct delta format (text)
    if (chunk.delta) {
      const text = typeof chunk.delta === 'string' ? chunk.delta : chunk.delta.content || null;
      return text ? { kind: 'text', delta: text } : null;
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

    for await (const part of this.parseStream(reader)) {
      if (part.kind === 'text') {
        fullText += part.delta;
      }
    }

    return fullText;
  }

  /**
   * Stream with callbacks
   * Text deltas go to onChunk; reasoning (thinking) deltas go to onReasoning.
   */
  static async streamWithCallbacks(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    onChunk: (chunk: string) => void,
    onComplete?: (fullText: string) => void,
    onError?: (error: Error) => void,
    onReasoning?: (chunk: string) => void
  ): Promise<void> {
    let fullText = '';

    try {
      for await (const part of this.parseStream(reader)) {
        if (part.kind === 'reasoning') {
          if (onReasoning) {
            onReasoning(part.delta);
          }
          continue;
        }
        fullText += part.delta;
        onChunk(part.delta);
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
