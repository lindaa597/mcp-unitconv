# mcp-unitconv

An MCP server that exposes unit conversion as a tool, so an assistant can convert
between units without guessing arithmetic.

Supports length, mass, time, volume and temperature.

## Install

```bash
npm install
npm run build
```

## Use with an MCP client

```json
{
  "mcpServers": {
    "unitconv": { "command": "node", "args": ["dist/server.js"] }
  }
}
```

## Tool

`convert(value, from, to)` returns the converted value, or an error when the two
units belong to different dimensions.

```
100 C  -> F   =>  212
1 km   -> m   =>  1000
1 km   -> kg  =>  error: dimension mismatch
```

Pass `conversions` (an array of `{ value, from, to }`) instead of `value`/`from`/`to`
to run several conversions in one call. Each item succeeds or fails on its own, so
one bad unit doesn't stop the rest of the batch:

```json
{ "conversions": [{ "value": 1, "from": "km", "to": "m" }, { "value": 100, "from": "C", "to": "F" }] }
```

## Test

```bash
npm test
```

## License

MIT
