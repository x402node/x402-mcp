import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["mcp-server.js"],
});

const client = new Client({ name: "test", version: "1.0.0" }, { capabilities: {} });
await client.connect(transport);
console.log("Connected.");

const tools = await client.listTools();
console.log("Tool count:", tools.tools.length);

console.log("\nCalling x402node_dev_uuid...");
const result = await client.callTool({ name: "x402node_dev_uuid", arguments: {} });
console.log("Result:", JSON.stringify(result, null, 2));

await client.close();
process.exit(0);
