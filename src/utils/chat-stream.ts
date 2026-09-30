import { PlayKitError } from '../types';
import type { ChatStreamEvent } from '../types';

/** Decode complete SSE frames; malformed events and incomplete streams are errors. */
export async function* readChatStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<ChatStreamEvent> {
  const decoder = new TextDecoder();
  let buffer = '',
    data: string[] = [],
    finished = false;
  const parse = (lines: string[]): ChatStreamEvent | null => {
    const text = lines.join('\n');
    if (text === '[DONE]') return null;
    let event: ChatStreamEvent;
    try {
      event = JSON.parse(text);
    } catch {
      throw new PlayKitError('Invalid chat stream event', 'INVALID_CHAT_STREAM');
    }
    if (!event || typeof event.type !== 'string')
      throw new PlayKitError('Invalid chat stream event', 'INVALID_CHAT_STREAM');
    return event;
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      if (done && buffer) {
        lines.push(buffer);
        buffer = '';
      }
      if (done) lines.push('');
      for (const line of lines) {
        if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
        else if (line === '' && data.length) {
          const event = parse(data);
          data = [];
          if (!event) continue;
          if (finished)
            throw new PlayKitError('Chat event after completion', 'INVALID_CHAT_STREAM');
          if (event.type === 'error' || event.type === 'tool-input-error')
            throw new PlayKitError(event.errorText || 'Chat stream failed', 'CHAT_STREAM_ERROR');
          if (event.type === 'abort')
            throw new DOMException(event.reason || 'Chat stream aborted', 'AbortError');
          if (event.type === 'finish' && event.finishReason === 'error') throw new PlayKitError('Chat generation failed', 'CHAT_STREAM_ERROR');
          if (event.type === 'finish') finished = true;
          yield event;
        }
      }
      if (done) break;
    }
    if (!finished)
      throw new PlayKitError('Chat stream ended before completion', 'INCOMPLETE_CHAT_STREAM');
  } finally {
    try {
      await reader.cancel();
    } finally {
      reader.releaseLock();
    }
  }
}
