import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, TOOLS } from '../src/server.ts';

// handleRequest writes JSON-RPC responses straight to process.stdout, so
// capture them by swapping the writer out for the duration of each call.
function captureWrites(run: () => void): any[] {
  const original = process.stdout.write.bind(process.stdout);
  const lines: string[] = [];
  process.stdout.write = ((chunk: string) => {
    lines.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  try {
    run();
  } finally {
    process.stdout.write = original;
  }
  return lines.join('').split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

test('initialize echoes the requested protocol version', () => {
  const [msg] = captureWrites(() => {
    handleRequest({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-01-01' } });
  });
  assert.equal(msg.id, 1);
  assert.equal(msg.result.protocolVersion, '2025-01-01');
  assert.equal(msg.result.serverInfo.name, 'mcp-unitconv');
});

test('initialize falls back to a default protocol version', () => {
  const [msg] = captureWrites(() => {
    handleRequest({ jsonrpc: '2.0', id: 1, method: 'initialize' });
  });
  assert.equal(msg.result.protocolVersion, '2024-11-05');
});

test('tools/list returns the convert tool', () => {
  const [msg] = captureWrites(() => {
    handleRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  });
  assert.deepEqual(msg.result.tools, TOOLS);
});

test('tools/call with valid args returns the converted value', () => {
  const [msg] = captureWrites(() => {
    handleRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'convert', arguments: { value: 1, from: 'km', to: 'm' } },
    });
  });
  assert.equal(msg.result.isError, false);
  const payload = JSON.parse(msg.result.content[0].text);
  assert.equal(payload.value, 1000);
  assert.equal(payload.dimension, 'length');
});

test('tools/call with a dimension mismatch reports isError', () => {
  const [msg] = captureWrites(() => {
    handleRequest({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'convert', arguments: { value: 1, from: 'km', to: 'kg' } },
    });
  });
  assert.equal(msg.result.isError, true);
  assert.match(msg.result.content[0].text, /量纲不匹配/);
});

test('tools/call with malformed arguments reports isError', () => {
  const [msg] = captureWrites(() => {
    handleRequest({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'convert', arguments: { value: '1', from: 'km', to: 'm' } },
    });
  });
  assert.equal(msg.result.isError, true);
  assert.match(msg.result.content[0].text, /expected/);
});

test('tools/call with an unknown tool name is a protocol error', () => {
  const [msg] = captureWrites(() => {
    handleRequest({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'not-a-real-tool', arguments: {} },
    });
  });
  assert.equal(msg.error.code, -32602);
  assert.match(msg.error.message, /unknown tool/);
});

test('unknown method is a protocol error', () => {
  const [msg] = captureWrites(() => {
    handleRequest({ jsonrpc: '2.0', id: 7, method: 'not/a/method' });
  });
  assert.equal(msg.error.code, -32601);
});

test('a request with no id is a notification and gets no reply', () => {
  const messages = captureWrites(() => {
    handleRequest({ jsonrpc: '2.0', method: 'initialize' });
  });
  assert.equal(messages.length, 0);
});
