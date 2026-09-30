import type { ChatConfig, SDKConfig } from '../types';
import { PlayKitError } from '../types';
import { AuthManager } from '../auth/AuthManager';
import { PlayerClient } from '../core/PlayerClient';
import { getSDKHeaders } from '../utils/sdkHeaders';
import { assertValidMessages } from '../utils/validateMessages';

declare const __PLAYKIT_BASE_URL__: string;
const PARAMETERS = [
  'model',
  'temperature',
  'maxTokens',
  'topP',
  'seed',
  'stop',
  'presencePenalty',
  'frequencyPenalty',
  'thinking',
  'variant',
  'tools',
  'tool_choice',
  'schema',
  'output',
  'schemaName',
  'schemaDescription',
  'enum',
] as const;

export class ChatProvider {
  private readonly baseURL: string;
  private playerClient?: PlayerClient;
  constructor(
    private readonly auth: AuthManager,
    private readonly config: SDKConfig
  ) {
    this.baseURL = (config.baseURL || __PLAYKIT_BASE_URL__).replace(/\/$/, '');
  }
  setPlayerClient(client: PlayerClient): void {
    this.playerClient = client;
  }
  async request(input: ChatConfig, stream: boolean, defaultModel?: string): Promise<Response> {
    if (input.prompt !== undefined && input.messages !== undefined)
      throw new PlayKitError('Choose messages or a managed prompt', 'INVALID_CHAT_INPUT');
    if (input.schema !== undefined && input.tools !== undefined)
      throw new PlayKitError(
        'Tools and structured output cannot be combined',
        'INVALID_CHAT_INPUT'
      );
    if (input.prompt?.version !== undefined && input.prompt.label !== undefined)
      throw new PlayKitError('Choose a prompt version or label', 'INVALID_CHAT_INPUT');
    const body: Record<string, unknown> = { stream };
    for (const key of PARAMETERS) if (input[key] !== undefined) body[key] = input[key];
    if (input.prompt) {
      Object.assign(body, {
        prompt: input.prompt,
        variables: input.variables,
        placeholders: input.placeholders,
        cache: input.cache,
      });
    } else {
      assertValidMessages(input.messages);
      body.messages = input.messages;
      body.model = input.model ?? defaultModel ?? this.config.defaultChatModel ?? 'default-chat';
      body.thinking =
        input.thinking ??
        (this.config.defaultThinkingEffort
          ? { effort: this.config.defaultThinkingEffort }
          : undefined);
    }
    if (input.signal?.aborted)
      throw input.signal.reason ?? new DOMException('Request aborted', 'AbortError');
    await this.auth.ensureValidToken();
    const token = this.auth.getToken();
    if (!token) throw new PlayKitError('Not authenticated', 'NOT_AUTHENTICATED');
    const response = await fetch(`${this.baseURL}/ai/${this.config.gameId}/v2/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...getSDKHeaders(),
      },
      body: JSON.stringify(body),
      signal: input.signal,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const nested =
        typeof payload.error === 'object' && payload.error !== null ? payload.error : payload;
      const error = new PlayKitError(
        typeof payload.error === 'string'
          ? payload.error
          : nested.message || response.statusText || 'Chat request failed',
        nested.code || payload.code || 'CHAT_REQUEST_FAILED',
        response.status
      );
      error.requestId =
        response.headers.get('X-PlayKit-Request-Id') ?? payload.traceId ?? payload.trace_id;
      error.details = payload.details ?? nested.details;
      if (response.status === 402 && this.config.mode !== 'server')
        await this.playerClient?.handleInsufficientCredits(error);
      throw error;
    }
    return response;
  }
  complete(): void {
    if (this.config.mode !== 'server')
      this.playerClient?.checkBalanceAfterApiCall().catch(() => {});
  }
}
