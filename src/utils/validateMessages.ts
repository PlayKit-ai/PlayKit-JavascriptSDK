import { PlayKitError } from '../types';
import type { Message, MessageContentPart } from '../types/common';

const VALID_PART_TYPES: ReadonlySet<string> = new Set([
  'text',
  'image',
  'image_url',
  'file',
  'audio',
  'input_audio',
]);

function describePart(part: any): string {
  if (part === null) return 'null';
  if (typeof part !== 'object') return typeof part;
  const keys = Object.keys(part).slice(0, 5).join(',');
  return `{${keys}}`;
}

/**
 * Validate that `messages` matches the SDK's `Message[]` runtime contract before
 * shipping to the chat API. Throws `PlayKitError('INVALID_MESSAGES')` when a
 * caller has wrapped a Message[] inside one user message's `content` (the
 * `[{role:'user', content: [{role,...}, ...]}]` anti-pattern that bypasses the
 * `MessageContentPart` type at runtime).
 *
 * Does NOT auto-flatten — silently guessing system/user roles would mask bugs.
 */
export function assertValidMessages(messages: Message[] | undefined | null): void {
  if (!Array.isArray(messages)) {
    throw new PlayKitError(
      'messages must be an array of Message',
      'INVALID_MESSAGES'
    );
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i] as Message;
    if (!msg || typeof msg !== 'object') {
      throw new PlayKitError(
        `messages[${i}] must be an object with {role, content}`,
        'INVALID_MESSAGES'
      );
    }

    const content = msg.content;
    if (typeof content === 'string' || content == null) continue;

    if (!Array.isArray(content)) {
      throw new PlayKitError(
        `messages[${i}].content must be a string or an array of content parts (got ${typeof content})`,
        'INVALID_MESSAGES'
      );
    }

    for (let j = 0; j < content.length; j++) {
      const part = content[j] as MessageContentPart | any;
      if (!part || typeof part !== 'object') {
        throw new PlayKitError(
          `messages[${i}].content[${j}] must be a content part object (got ${typeof part})`,
          'INVALID_MESSAGES'
        );
      }
      const hasType = typeof part.type === 'string' && VALID_PART_TYPES.has(part.type);
      if (!hasType) {
        if ('role' in part && 'content' in part) {
          throw new PlayKitError(
            `messages[${i}].content[${j}] is shaped like a Message (has role/content) ` +
              `but content parts must be {type:'text'|'image'|'image_url'|'file'|'audio'|'input_audio',...}. ` +
              `Did you mean to pass that array as messages directly? ` +
              `e.g. \`messages: theArray\` instead of \`messages: [{role:'user', content: theArray}]\`. ` +
              `Got part ${describePart(part)}`,
            'INVALID_MESSAGES'
          );
        }
        throw new PlayKitError(
          `messages[${i}].content[${j}] is missing a recognized 'type' field ` +
            `(expected one of text|image|image_url|file|audio|input_audio). Got part ${describePart(part)}`,
          'INVALID_MESSAGES'
        );
      }
    }
  }
}
