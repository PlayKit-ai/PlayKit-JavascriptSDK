# JavaScript SDK 2.0

Chat has two operations: `generate(config)` and `stream(config)`. Both accept the
same message input, managed prompt selector, tools, schema and model parameters.
Both return a `ChatResult`, including usage, request ID, actual model, tool calls
and resolved prompt version when available.

| Previous API | 2.0 |
| --- | --- |
| `chat(message, systemPrompt)` | `generate({ messages: [...] })`, read `result.content` |
| `textGeneration(config)` | `generate(config)` |
| `textGenerationWithTools(config)` | `generate({ messages, tools, ... })` |
| `generateStructuredByName`, `generateStructuredWithSchema`, `generateStructuredWithMessages`, `generateStructuredAdvanced`, `generateStructured` | `generate<T>({ messages, schema, ... })`, read `result.output` |
| `chatStream`, `textGenerationStream`, `textGenerationWithToolsStream` | `stream({ messages, tools?, schema?, onChunk?, onReasoning?, onEvent?, signal? })` |
| Streaming `onComplete` / `onError` callbacks | Await the returned result; catch rejected promises |
| `PromptClient` / `createPromptClient` | Manage prompts through the web console or REST API. Execute existing prompts with `ChatClient.generate` / `ChatClient.stream` and `{ prompt, variables, placeholders }` |
| `SchemaLibrary`, `getSchemaLibrary`, `setSchemaLibrary` | Pass JSON Schema directly or store it in prompt version config |
| `thinking.enabled` | `thinking: { effort: 'off' }` or the desired effort |
| `NPCClient` / `AIContextManager` | Application-owned messages and state |

Raw-message requests choose the per-call model, then the chat client's model,
then the SDK default, then `default-chat`. Managed prompts use their version's
configuration and only explicit per-call overrides. Defaults never silently
replace a managed prompt's saved model or thinking settings. Zero-valued
parameters are preserved. Wire parameters use the gateway's camelCase names.

Streaming exposes gateway UI-message events through `onEvent`. Complete tool
inputs are returned in `result.tool_calls`; the SDK does not execute tools or
update conversation history. Malformed events, interrupted streams and explicit
abort/error events reject the promise. `AbortSignal` cancels the underlying
request. Structured output is parsed only after successful completion.

`mode: 'server'` initialization sets up token authentication without fetching a
player profile. Chat requests in that mode do not initiate balance UI or extra
balance reads. Browser-mode account behavior is unchanged in this revision.

The current artifact is `playkit-sdk-2.0.0-next.1.tgz`. The Services dashboard uses
this local version package while 2.0 is under development; npm publication and
switching to a registry dependency are separate release steps.

Prompt management, including version creation, publication, template retrieval,
local compilation and experiments, is handled by the web console or REST API.
Runtime prompt selectors and version receipts remain part of the Chat API.
