#!/usr/bin/env node
import express from 'express';
import { Server as McpServerLowlevel } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './server.js';

const PORT = Number(process.env.PORT || 8958);
const HOST = process.env.HOST || '127.0.0.1';

function log(msg: string): void {
  // eslint-disable-next-line no-console
  console.error(`[sudnokontrol-mcp] ${msg}`);
}

async function startStdio(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('stdio transport running');
}

async function startHttp(): Promise<void> {
  const app = express();
  app.use(express.json());

  // Stateless Streamable HTTP endpoint: one request = one fresh transport/server.
  app.use('/mcp', async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
    });
    const server = createMcpServer();
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      log(`transport error: ${err instanceof Error ? err.message : String(err)}`);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal error', data: undefined },
          id: null,
        });
      }
    }
  });

  const listener = app.listen(PORT, HOST, () => {
    log(`HTTP transport running at http://${HOST}:${PORT}/mcp`);
  });
  listener.on('error', (err) => {
    log(`listen error: ${err.message}`);
    process.exit(1);
  });
}

async function main(): Promise<void> {
  const mode = process.argv[2] === 'http' ? 'http' : process.argv[2] === 'stdio' ? 'stdio' : process.env.MCP_TRANSPORT === 'http' ? 'http' : 'stdio';
  if (mode === 'http') {
    await startHttp();
  } else {
    await startStdio();
  }
}

main().catch((err) => {
  log(`fatal: ${err instanceof Error ? err.stack || err.message : String(err)}`);
  process.exit(1);
});