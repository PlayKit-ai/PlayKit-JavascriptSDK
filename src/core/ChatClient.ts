import type {
  ChatConfig,
  ChatStreamConfig,
  ChatResult,
  ChatCompletionResponse,
  ChatStreamMetadata,
  MessageContent,
  ToolCall,
} from '../types';
import { PlayKitError } from '../types';
import { ChatProvider } from '../providers/ChatProvider';
import { readChatStream } from '../utils/chat-stream';

function contentText(content: MessageContent | null | undefined): string {
  if (typeof content === 'string') return content;
  return content?.map((part) => (part.type === 'text' ? part.text : '')).join('') ?? '';
}
function metadata(response: Response): ChatStreamMetadata {
  const requestId = response.headers.get('X-PlayKit-Request-Id') ?? undefined;
  const version = response.headers.get('X-PlayKit-Prompt-Version');
  const versionId = response.headers.get('X-PlayKit-Prompt-Version-Id');
  return {
    requestId,
    model: response.headers.get('X-PlayKit-Model') ?? undefined,
    requestedModel: response.headers.get('X-PlayKit-Requested-Model') ?? undefined,
    structuredOutput: response.headers.get('X-PlayKit-Structured-Output') === 'true',
    ...(version !== null && versionId
      ? { prompt: { requestId: requestId ?? null, versionId, version: Number(version) } }
      : {}),
  };
}
function structured<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new PlayKitError('Invalid structured output', 'INVALID_STRUCTURED_OUTPUT');
  }
}

export class ChatClient {
  constructor(
    private readonly provider: ChatProvider,
    private readonly defaultModel?: string
  ) {}
  async generate<T = unknown>(config: ChatConfig): Promise<ChatResult<T>> {
    const response = await this.provider.request(config, false, this.defaultModel);
    const meta = metadata(response);
    const body: ChatCompletionResponse = await response.json();
    const choice = body.choices[0];
    if (!choice) throw new PlayKitError('Chat response has no choice', 'INVALID_CHAT_RESPONSE');
    const content = contentText(choice.message.content);
    const result: ChatResult<T> = {
      content,
      model: meta.model ?? body.model,
      requestedModel: meta.requestedModel ?? config.model,
      finishReason: choice.finish_reason,
      id: body.id,
      created: body.created,
      requestId: meta.requestId,
      tool_calls: choice.message.tool_calls,
      reasoning: choice.message.reasoning_content,
      prompt: meta.prompt,
      usage: body.usage
        ? {
            promptTokens: body.usage.prompt_tokens,
            completionTokens: body.usage.completion_tokens,
            totalTokens: body.usage.total_tokens,
          }
        : undefined,
    };
    if (body.output !== undefined) result.output = body.output as T;
    else if (config.schema !== undefined || meta.structuredOutput)
      result.output = structured<T>(content);
    this.provider.complete();
    return result;
  }
  async stream<T = unknown>(config: ChatStreamConfig): Promise<ChatResult<T>> {
    const response = await this.provider.request(config, true, this.defaultModel);
    if (!response.body)
      throw new PlayKitError('Missing chat response stream', 'INVALID_CHAT_RESPONSE');
    let meta = metadata(response);
    const result: ChatResult<T> = {
      content: '',
      model: meta.model ?? config.model ?? '',
      finishReason: 'unknown',
    };
    const tools = new Map<string, ToolCall>();
    for await (const event of readChatStream(response.body.getReader())) {
      if (event.messageMetadata) meta = { ...meta, ...event.messageMetadata };
      if (event.type === 'start') result.id = event.messageId;
      if (event.type === 'text-delta') {
        result.content += event.delta ?? '';
        config.onChunk?.(event.delta ?? '');
      }
      if (event.type === 'reasoning-delta') {
        result.reasoning = (result.reasoning ?? '') + (event.delta ?? '');
        config.onReasoning?.(event.delta ?? '');
      }
      if (event.type === 'tool-input-available' && event.toolCallId && event.toolName)
        tools.set(event.toolCallId, {
          id: event.toolCallId,
          type: 'function',
          function: { name: event.toolName, arguments: JSON.stringify(event.input ?? {}) },
        });
      if (event.type === 'finish') result.finishReason = event.finishReason ?? 'unknown';
      config.onEvent?.(event);
    }
    result.model = meta.model ?? result.model;
    result.requestedModel = meta.requestedModel ?? config.model;
    result.requestId = meta.requestId;
    result.usage = meta.usage;
    result.prompt = meta.prompt;
    if (tools.size) result.tool_calls = Array.from(tools.values());
    if (config.schema !== undefined || meta.structuredOutput)
      result.output = structured<T>(result.content);
    this.provider.complete();
    return result;
  }
}
