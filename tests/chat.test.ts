import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatClient } from '../src/core/ChatClient';
import { ChatProvider } from '../src/providers/ChatProvider';
import { PlayKitError } from '../src/types';
const fetchOriginal = globalThis.fetch;
function client(defaults: Record<string, unknown> = {}) {
  let authReads = 0;
  const auth = {
    ensureValidToken: async () => {
      authReads++;
    },
    getToken: () => 'token',
  };
  return {
    chat: new ChatClient(
      new ChatProvider(
        auth as any,
        { gameId: 'game', baseURL: 'http://chat.test', mode: 'server', ...defaults } as any
      )
    ),
    reads: () => authReads,
  };
}
function response(
  content = 'hello',
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {}
) {
  return Response.json(
    {
      id: 'completion',
      model: 'requested',
      choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
      ...extra,
    },
    { headers: { 'X-PlayKit-Request-Id': 'request', 'X-PlayKit-Model': 'actual', ...headers } }
  );
}
function stream(events: unknown[], headers: Record<string, string> = {}) {
  const text =
    events.map((e) => 'data: ' + JSON.stringify(e) + '\r\n\r\n').join('') + 'data: [DONE]\r\n\r\n';
  const bytes = new TextEncoder().encode(text);
  return new Response(
    new ReadableStream({
      start(c) {
        for (let i = 0; i < bytes.length; i += 3) c.enqueue(bytes.slice(i, i + 3));
        c.close();
      },
    }),
    { headers }
  );
}
test('one request preserves full history, camelCase parameters, explicit zero values and thinking override', async () => {
  let sent: any;
  globalThis.fetch = async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return response();
  };
  try {
    const c = client({ defaultThinkingEffort: 'high' });
    const messages = [
      { role: 'system' as const, content: 'system' },
      { role: 'user' as const, content: 'old' },
      { role: 'assistant' as const, content: 'answer' },
      { role: 'user' as const, content: 'next' },
    ];
    const r = await c.chat.generate({
      messages,
      temperature: 0,
      seed: 0,
      topP: 0,
      maxTokens: 20,
      presencePenalty: 0,
      thinking: { effort: 'off' },
    });
    assert.deepEqual(sent.messages, messages);
    assert.equal(sent.maxTokens, 20);
    assert.equal(sent.max_tokens, undefined);
    assert.equal(sent.topP, 0);
    assert.equal(sent.seed, 0);
    assert.equal(sent.temperature, 0);
    assert.deepEqual(sent.thinking, { effort: 'off' });
    assert.equal(c.reads(), 1);
    assert.equal(r.model, 'actual');
    assert.equal(r.requestId, 'request');
    assert.equal(r.usage?.totalTokens, 6);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
test('structured generation sends direct schema and all messages and returns parsed output with usage', async () => {
  let sent: any;
  const schema = { type: 'object', properties: { count: { type: 'number' } } };
  globalThis.fetch = async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return response('{"count":2}');
  };
  try {
    const r = await client().chat.generate<{ count: number }>({
      messages: [
        { role: 'system', content: 'count' },
        { role: 'user', content: 'two' },
      ],
      schema,
    });
    assert.deepEqual(sent.schema, schema);
    assert.equal(sent.response_format, undefined);
    assert.equal(sent.messages.length, 2);
    assert.equal(r.output?.count, 2);
    assert.equal(r.usage?.promptTokens, 4);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
test('tool generation uses the same authenticated request and retains calls', async () => {
  const tool = {
    type: 'function' as const,
    function: { name: 'inventory', parameters: { type: 'object' } },
  };
  const call = { id: 't1', type: 'function', function: { name: 'inventory', arguments: '{}' } };
  let sent: any;
  globalThis.fetch = async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return response('', {
      choices: [
        {
          message: { role: 'assistant', content: '', tool_calls: [call] },
          finish_reason: 'tool-calls',
        },
      ],
    });
  };
  try {
    const c = client();
    const r = await c.chat.generate({
      messages: [{ role: 'user', content: 'inventory' }],
      tools: [tool],
      tool_choice: 'required',
    });
    assert.deepEqual(sent.tools, [tool]);
    assert.equal(sent.tool_choice, 'required');
    assert.deepEqual(r.tool_calls, [call]);
    assert.equal(c.reads(), 1);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
test('managed calls preserve version configuration instead of injecting client defaults', async () => {
  let sent: any;
  globalThis.fetch = async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return response(
      'hello',
      {},
      { 'X-PlayKit-Prompt-Version': '3', 'X-PlayKit-Prompt-Version-Id': 'v3' }
    );
  };
  try {
    const r = await client({
      defaultChatModel: 'client-model',
      defaultThinkingEffort: 'high',
    }).chat.generate({
      prompt: { name: 'greeting' },
      variables: { name: 'Mira' },
      placeholders: { history: [] },
    });
    assert.equal(sent.model, undefined);
    assert.equal(sent.thinking, undefined);
    assert.equal(sent.temperature, undefined);
    assert.equal(sent.messages, undefined);
    assert.equal(r.prompt?.version, 3);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
test('saved structured prompts expose parsed output even without a client schema', async () => {
  globalThis.fetch = async () =>
    response('{"ok":true}', { output: { ok: true } }, { 'X-PlayKit-Structured-Output': 'true' });
  try {
    assert.deepEqual((await client().chat.generate({ prompt: { name: 'structured' } })).output, {
      ok: true,
    });
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
test('streaming retains fragmented Unicode, reasoning, tools, usage and actual version metadata', async () => {
  const events = [
    { type: 'start', messageId: 'message' },
    { type: 'reasoning-delta', delta: '想' },
    { type: 'text-delta', delta: '你好' },
    {
      type: 'tool-input-available',
      toolCallId: 'call',
      toolName: 'inventory',
      input: { count: 2 },
    },
    {
      type: 'finish',
      finishReason: 'tool-calls',
      messageMetadata: {
        model: 'actual-stream',
        requestedModel: 'default-chat',
        requestId: 'request-stream',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        prompt: { version: 4, versionId: 'v4', requestId: 'request-stream' },
      },
    },
  ];
  globalThis.fetch = async () => stream(events);
  try {
    let text = '',
      reasoning = '';
    const seen: string[] = [];
    const r = await client().chat.stream({
      prompt: { name: 'greeting' },
      onChunk: (x) => {
        text += x;
      },
      onReasoning: (x) => {
        reasoning += x;
      },
      onEvent: (e) => {
        seen.push(e.type);
      },
    });
    assert.equal(text, '你好');
    assert.equal(reasoning, '想');
    assert.equal(r.usage?.totalTokens, 15);
    assert.equal(r.model, 'actual-stream');
    assert.equal(r.requestId, 'request-stream');
    assert.equal(r.prompt?.version, 4);
    assert.equal(r.finishReason, 'tool-calls');
    assert.deepEqual(JSON.parse(r.tool_calls![0].function.arguments), { count: 2 });
    assert(seen.includes('tool-input-available'));
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
test('streaming schema output is parsed only on successful finish', async () => {
  globalThis.fetch = async () =>
    stream([
      { type: 'text-delta', delta: '{"count":2}' },
      { type: 'finish', finishReason: 'stop', messageMetadata: { structuredOutput: true } },
    ]);
  try {
    const r = await client().chat.stream<{ count: number }>({ prompt: { name: 'structured' } });
    assert.equal(r.output?.count, 2);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
test('stream errors, invalid JSON, DONE-only truncation and aborts reject instead of becoming text or success', async () => {
  for (const [data, expected] of [
    ['data: {"type":"error","errorText":"provider failed"}\n\n', /provider failed/],
    ['data: not-json\n\n', /Invalid chat/],
    ['data: {"type":"text-delta","delta":"partial"}\n\ndata: [DONE]\n\n', /before completion/],
    ['data: {"type":"abort"}\n\n', /aborted/],
  ] as const) {
    globalThis.fetch = async () => new Response(data);
    try {
      await assert.rejects(
        () => client().chat.stream({ messages: [{ role: 'user', content: 'hello' }] }),
        expected
      );
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  }
});
test('AbortSignal reaches fetch and already-aborted calls do not request authentication', async () => {
  const controller = new AbortController();
  let signal: AbortSignal | null | undefined;
  globalThis.fetch = async (_url, init) => {
    signal = init?.signal;
    return response();
  };
  try {
    const c = client();
    await c.chat.generate({
      messages: [{ role: 'user', content: 'hi' }],
      signal: controller.signal,
    });
    assert.equal(signal, controller.signal);
    controller.abort();
    await assert.rejects(
      () =>
        c.chat.generate({ messages: [{ role: 'user', content: 'hi' }], signal: controller.signal }),
      { name: 'AbortError' }
    );
    assert.equal(c.reads(), 1);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
test('mixed input and mixed tool/schema modes are rejected before any network call', async () => {
  const c = client();
  await assert.rejects(
    () => c.chat.generate({ prompt: { name: 'a' }, messages: [] } as any),
    /Choose/
  );
  await assert.rejects(
    () => c.chat.generate({ messages: [], schema: {}, tools: [] } as any),
    /cannot be combined/
  );
  assert.equal(c.reads(), 0);
});
test('HTTP errors retain server message, code, status, details and request id', async () => {
  globalThis.fetch = async () =>
    Response.json(
      { error: 'No permission', code: 'FORBIDDEN', details: { scope: 'prompt:read' } },
      { status: 403, headers: { 'X-PlayKit-Request-Id': 'failed-request' } }
    );
  try {
    await assert.rejects(
      () => client().chat.generate({ prompt: { name: 'a' } }),
      (e) =>
        e instanceof PlayKitError &&
        e.message === 'No permission' &&
        e.code === 'FORBIDDEN' &&
        e.statusCode === 403 &&
        e.requestId === 'failed-request' &&
        (e.details as any).scope === 'prompt:read'
    );
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test('cancelling an active HTTP stream closes the request and rejects the stream promise', async () => {
  const { createServer } = await import('node:http');
  let closed: (() => void) | undefined;
  const connectionClosed = new Promise<void>(resolve => { closed = resolve; });
  const server = createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.write('data: {"type":"text-delta","delta":"first"}\n\n');
    res.on('close', () => closed?.());
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const controller = new AbortController();
  try {
    await assert.rejects(() => client({ baseURL: `http://127.0.0.1:${address.port}` }).chat.stream({ messages: [{ role: 'user', content: 'hi' }], signal: controller.signal, onChunk: () => controller.abort() }), { name: 'AbortError' });
    await connectionClosed;
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
