#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { convert, supportedUnits } from './units.ts';

/**
 * MCP stdio transport: newline-delimited JSON-RPC 2.0, no Content-Length
 * framing. Hand-rolled here instead of pulling in @modelcontextprotocol/sdk
 * so the server has zero runtime dependencies.
 */

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
}

const TOOL_NAME = 'convert';

export const TOOLS = [
  {
    name: TOOL_NAME,
    description:
      'Convert a numeric value between units of the same dimension ' +
      '(length, mass, time, temperature). Fails if the units belong to ' +
      'different dimensions. Pass `conversions` instead of value/from/to to ' +
      'run a batch in one call; each item succeeds or fails independently.',
    inputSchema: {
      type: 'object',
      properties: {
        value: { type: 'number', description: 'the numeric value to convert (single conversion)' },
        from: { type: 'string', description: `source unit, one of: ${supportedUnits().join(', ')}` },
        to: { type: 'string', description: `target unit, one of: ${supportedUnits().join(', ')}` },
        conversions: {
          type: 'array',
          description: 'a batch of conversions to run in one call; when present, value/from/to are ignored',
          items: {
            type: 'object',
            properties: {
              value: { type: 'number' },
              from: { type: 'string' },
              to: { type: 'string' },
            },
            required: ['value', 'from', 'to'],
          },
        },
      },
    },
  },
];

interface BatchItemResult {
  value?: number;
  from: string;
  to: string;
  dimension?: string;
  error?: string;
}

function convertBatchItem(item: unknown): BatchItemResult {
  const { value, from, to } = (item ?? {}) as Record<string, unknown>;
  if (typeof value !== 'number' || typeof from !== 'string' || typeof to !== 'string') {
    return {
      from: typeof from === 'string' ? from : String(from),
      to: typeof to === 'string' ? to : String(to),
      error: 'expected { value: number, from: string, to: string }',
    };
  }
  try {
    return convert(value, from, to);
  } catch (err) {
    return { from, to, error: err instanceof Error ? err.message : String(err) };
  }
}

function send(message: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(message) + '\n');
}

function sendResult(id: number | string, result: unknown): void {
  send({ jsonrpc: '2.0', id, result });
}

function sendError(id: number | string, code: number, message: string): void {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

function handleToolsCall(id: number | string, params: Record<string, unknown> | undefined): void {
  const name = params?.name;
  const args = (params?.arguments ?? {}) as Record<string, unknown>;

  if (name !== TOOL_NAME) {
    sendError(id, -32602, `unknown tool: ${String(name)}`);
    return;
  }

  try {
    if (Array.isArray(args.conversions)) {
      const results = args.conversions.map(convertBatchItem);
      sendResult(id, {
        content: [{ type: 'text', text: JSON.stringify(results) }],
        isError: results.some((r) => r.error !== undefined),
      });
      return;
    }

    const value = args.value;
    const from = args.from;
    const to = args.to;
    if (typeof value !== 'number' || typeof from !== 'string' || typeof to !== 'string') {
      throw new Error('expected { value: number, from: string, to: string }');
    }
    const result = convert(value, from, to);
    sendResult(id, {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      isError: false,
    });
  } catch (err) {
    sendResult(id, {
      content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
      isError: true,
    });
  }
}

export function handleRequest(req: JsonRpcRequest): void {
  const { id, method, params } = req;

  // Notifications carry no id and get no response.
  if (id === undefined) return;

  switch (method) {
    case 'initialize':
      sendResult(id, {
        protocolVersion: (params?.protocolVersion as string) ?? '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'mcp-unitconv', version: '0.1.0' },
      });
      break;
    case 'tools/list':
      sendResult(id, { tools: TOOLS });
      break;
    case 'tools/call':
      handleToolsCall(id, params);
      break;
    default:
      sendError(id, -32601, `method not found: ${method}`);
  }
}

const rl = createInterface({ input: process.stdin });

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let req: JsonRpcRequest;
  try {
    req = JSON.parse(trimmed);
  } catch {
    // Malformed JSON with no parseable id: per spec this is a parse error
    // notification, there's no id to reply to sensibly, so just drop it.
    return;
  }
  handleRequest(req);
});
