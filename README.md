<!-- mcp-name: io.github.x402node/x402-mcp -->

# x402-mcp

MCP server bringing 100+ x402-paid APIs to AI agents (Claude, Cursor, MCP-aware clients). Auto-discovers tools from CDP Bazaar; handles USDC micropayments on Base + Solana.

## Features

- Auto-discovers x402 endpoints from CDP Bazaar (no hard-coded list)
- Reads metadata directly from Bazaar (description, schema, pricing)
- Refreshes every 5 min — new endpoints appear without restart
- Handles HTTP 402 + USDC payment automatically
- Multi-chain: Base + Solana mainnet live (USDC on both); Polygon/BNB/EVM expandable

## Install (Claude Desktop)

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "x402-mcp": {
      "command": "npx",
      "args": ["-y", "x402node-mcp"],
      "env": { "X402_PRIVATE_KEY": "0xYOUR_BASE_PRIVATE_KEY" }
    }
  }
}
```

Set `X402_PRIVATE_KEY` to a Base EOA private key (hex, 0x-prefixed) with USDC on Base mainnet (Solana payment via SPL USDC also supported). Restart Claude Desktop. The server auto-discovers ~117 tools on first run.

## Cost Safety

- Each tool call costs $0.0001-$0.10 USDC depending on endpoint
- Hard cap: `MAX_PRICE_USD` env var (default $0.10/call); calls above are blocked
- Use a fresh burner wallet, not your main wallet

## How it works

Agent calls tool -> HTTP 402 -> x402-fetch signs EIP-3009 -> CDP Facilitator settles on Base or Solana -> response returned. Buyer pays no gas.

## Development

```bash
git clone https://github.com/x402node/x402-mcp
cd x402-mcp
npm install
cp .env.example .env  # edit X402_PRIVATE_KEY
node mcp-server.js
```

## Links

- x402 protocol: https://x402.org
- CDP Bazaar: https://docs.cdp.coinbase.com/x402/bazaar
- MCP: https://modelcontextprotocol.io
- npm: https://www.npmjs.com/package/x402node-mcp
- Glama: https://glama.ai/mcp/servers/x402node/x402-mcp

## License

MIT
