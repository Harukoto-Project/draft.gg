import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import type { OpggTransport } from "./types.js";

const ENDPOINT = "https://mcp-api.op.gg/mcp";
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * OP.GG の公式 MCP(Streamable HTTP)に接続する。
 * 呼び出し間隔と同時実行は、このクライアントの利用者(ジョブ)が制御する。
 */
export async function connectOpggTransport(clientName = "draftgg-worker"): Promise<OpggTransport> {
  const client = new Client({ name: clientName, version: "0.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(ENDPOINT));
  await client.connect(transport);

  return {
    async callTool(name, args) {
      const result = await client.callTool({ name, arguments: args }, undefined, {
        timeout: REQUEST_TIMEOUT_MS,
      });
      if (isErrorResult(result)) {
        throw new Error(`OP.GG の呼び出しに失敗しました: ${name}`);
      }
      return result;
    },
    async close() {
      await client.close();
    },
  };
}

function isErrorResult(result: unknown): boolean {
  return Boolean(result && typeof result === "object" && "isError" in result && result.isError);
}
