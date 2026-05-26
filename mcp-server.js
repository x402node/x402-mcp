#!/usr/bin/env node
import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http } from "viem";
import { base } from "viem/chains";
import { wrapFetchWithPayment } from "x402-fetch";

const PAY_TO = process.env.X402_PAY_TO || "0x4466d4A84b7c49a6A094ec6eef4a0712D6dd125e";
const PRIVATE_KEY = process.env.X402_PRIVATE_KEY;
const RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const MAX_PRICE_USD = parseFloat(process.env.X402_MAX_PRICE_USD || "0.5");
const REFRESH_MIN = parseInt(process.env.X402_REFRESH_MIN || "5");

if (!PRIVATE_KEY) {
  console.error("ERROR: Set X402_PRIVATE_KEY in environment");
  process.exit(1);
}

const DISCOVERY = `https://api.cdp.coinbase.com/platform/v2/x402/discovery/merchant?payTo=${PAY_TO}`;

const account = privateKeyToAccount(PRIVATE_KEY);
const wallet = createWalletClient({ account, chain: base, transport: http(RPC_URL) });
const payFetch = wrapFetchWithPayment(fetch, wallet, BigInt(Math.floor(MAX_PRICE_USD * 1e6)));

async function loadResources() {
  const all = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const r = await fetch(`${DISCOVERY}&limit=${limit}&offset=${offset}`);
    if (!r.ok) throw new Error(`Bazaar HTTP ${r.status}`);
    const j = await r.json();
    const items = j.resources || [];
    all.push(...items);
    const total = j.pagination?.total || items.length;
    if (offset + items.length >= total || items.length === 0) break;
    offset += items.length;
  }
  return all;
}

function pathToToolName(resourceUrl) {
  const u = new URL(resourceUrl);
  const site = u.hostname.replace(/^api\./, "").replace(/\.(dev|com|net|io)$/, "").replace(/[^a-z0-9]/gi, "");
  const path = u.pathname.replace(/^\/+/, "").replace(/\//g, "_");
  return `${site}_${path}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
}

function resourceToTool(resource) {
  const accept = (resource.accepts && resource.accepts[0]) || {};
  const bazaar = (accept.extensions && accept.extensions.bazaar && accept.extensions.bazaar.info) || {};
  const input = bazaar.input || {};
  const queryParams = input.queryParams || {};
  const method = (input.method || "GET").toUpperCase();
  const priceUsd = accept.amount ? parseInt(accept.amount) / 1e6 : null;
  const priceStr = priceUsd !== null ? `$${priceUsd.toFixed(4)} USDC` : "unknown";

  const props = {};
  const required = [];
  for (const [k, desc] of Object.entries(queryParams)) {
    props[k] = { type: "string", description: String(desc) };
    if (/required/i.test(String(desc))) required.push(k);
  }

  const name = pathToToolName(resource.resource);
  const desc = (accept.description || resource.resource).slice(0, 500);

  return {
    name,
    description: `${desc}\n\nPrice: ${priceStr} on Base (auto-paid in USDC).`,
    inputSchema: { type: "object", properties: props, required },
    _resource: resource.resource,
    _method: method,
    _priceUsd: priceUsd,
  };
}

const server = new Server({ name: "x402-cn402-x402node", version: "0.1.0" }, { capabilities: { tools: {} } });

let TOOLS = [];
let TOOL_MAP = {};

async function refreshTools() {
  try {
    const resources = await loadResources();
    const tools = resources.map(resourceToTool);
    const seen = new Set();
    TOOLS = tools.filter(t => {
      if (seen.has(t.name)) return false;
      seen.add(t.name);
      return true;
    });
    TOOL_MAP = Object.fromEntries(TOOLS.map(t => [t.name, t]));
    console.error(`[mcp] loaded ${TOOLS.length} tools from Bazaar (payTo=${PAY_TO})`);
  } catch (e) {
    console.error(`[mcp] refresh failed: ${e.message}`);
  }
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = TOOL_MAP[req.params.name];
  if (!tool) {
    return { content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }], isError: true };
  }
  if (tool._priceUsd !== null && tool._priceUsd > MAX_PRICE_USD) {
    return { content: [{ type: "text", text: `Tool costs $${tool._priceUsd} > max $${MAX_PRICE_USD}` }], isError: true };
  }
  const url = new URL(tool._resource);
  const args = req.params.arguments || {};
  try {
    let resp;
    if (tool._method === "GET") {
      for (const [k, v] of Object.entries(args)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
      resp = await payFetch(url.toString());
    } else {
      resp = await payFetch(url.toString(), {
        method: tool._method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
    }
    const text = await resp.text();
    if (resp.status !== 200) {
      return { content: [{ type: "text", text: `HTTP ${resp.status}: ${text.slice(0, 800)}` }], isError: true };
    }
    return { content: [{ type: "text", text }] };
  } catch (e) {
    return { content: [{ type: "text", text: `x402 call failed: ${e.message}` }], isError: true };
  }
});

await refreshTools();
setInterval(refreshTools, REFRESH_MIN * 60 * 1000);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[mcp] x402-cn402-x402node MCP server ready on stdio");
