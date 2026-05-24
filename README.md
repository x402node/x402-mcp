# x402-mcp

MCP server bringing 100+ x402-paid APIs to AI agents (Claude, Cursor, MCP-aware clients). Auto-discovers tools from CDP Bazaar; handles USDC micropayments on Base.

## Features

- Auto-discovers x402 endpoints from CDP Bazaar (no hard-coded list)
- Reads metadata directly from Bazaar (description, schema, pricing)
- Refreshes every 5 min — new endpoints appear without restart
- Handles HTTP 402 + USDC payment automatically
- Multi-chain ready via x402 protocol (Base today; Solana, Polygon, BNB, EVM expansion)

## Install

```bash
git clone https://github.com/x402node/x402-mcp
cd x402-mcp
npm install
cp .env.example .env
```

Edit `.env`: set `X402_PRIVATE_KEY` to a Base EOA with USDC.

## Use with Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "x402-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/x402-mcp/mcp-server.js"],
      "env": { "X402_PRIVATE_KEY": "0xYOUR_KEY" }
    }
  }
}
```

## How it works

Agent calls tool → HTTP 402 → x402-fetch signs EIP-3009 → CDP Facilitator settles on Base → response returned. Buyer pays no gas.

## Links

- x402 protocol: https://x402.org
- CDP Bazaar: https://docs.cdp.coinbase.com/x402/bazaar
- MCP: https://modelcontextprotocol.io

## License

MIT
