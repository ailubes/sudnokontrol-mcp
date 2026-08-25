import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/**
 * Base URL of the public SudnoKontrol API.
 * Override with SUDNOKONTROL_API env var.
 */
const API_BASE = process.env.SUDNOKONTROL_API || 'https://api.sk.ukrfish.org/api/ai';

/**
 * Read-only hints shared by all SudnoKontrol tools (required by OpenAI plugin review).
 * These tools query an external public dataset, never modify anything, are
 * idempotent, and are not destructive.
 */
const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'SudnoKontrol',
    version: '1.0.0',
  });

  server.registerTool(
    'search_vessel_registries',
    {
      title: 'Search Ukrainian national vessel registries',
      description:
        'Search public data from the Ukrainian State Ship Registry and Ship Book by free-text query and structured filters. Deterministic ordering with exact registration-number matches first. Handles Cyrillic and Latin scripts and separator-insensitive numbers (УПС-0129 ≡ УПС 0129 ≡ UPS-0129). Each result includes a web_url pointing to the public vessel information page.',
      inputSchema: {
        q: z.string().min(2).optional().describe('Registration number, vessel name, or owner name. Accepts Latin or Cyrillic.'),
        vessel_type: z.string().optional().describe('Partial match on vessel type (e.g. земснаряд).'),
        build_year_min: z.number().int().min(1900).max(2100).optional().describe('Inclusive minimum build year.'),
        build_year_max: z.number().int().min(1900).max(2100).optional().describe('Inclusive maximum build year.'),
        home_port: z.string().optional().describe('Partial match on home port.'),
        source: z.enum(['registry', 'book', 'both']).optional().describe('Dataset to search.'),
        limit: z.number().int().min(1).max(50).optional().describe('Page size.'),
        offset: z.number().int().min(0).optional().describe('Pagination offset.'),
      },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (args) => {
      try {
        const a = args || {};
        const data = (await getJson(
          `${API_BASE}/registry/search${qs({
            q: a.q,
            vessel_type: a.vessel_type,
            build_year_min: a.build_year_min,
            build_year_max: a.build_year_max,
            home_port: a.home_port,
            source: a.source,
            limit: a.limit,
            offset: a.offset,
          })}`
        )) as { items: unknown[]; total: number };
        return {
          content: [{ type: 'text', text: JSON.stringify({ items: data.items, total: data.total }) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'search_failed';
        return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: message }) }] };
      }
    }
  );

  server.registerTool(
    'lookup_vessel',
    {
      title: 'Look up a Ukrainian vessel',
      description:
        'Look up a vessel in the Ukrainian vessel registries using its registration number. Handles -, ., and space variance and Latin/Cyrillic forms. Returns the full public registry record, including a web_url pointing to the public vessel information page.',
      inputSchema: {
        registration_number: z.string().min(3).describe('Registration number, for example УПС-0129.'),
      },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (args) => {
      try {
        const a = args || {};
        const data = (await getJson(
          `${API_BASE}/registry/lookup/${encodeURIComponent(a.registration_number)}`
        )) as unknown;
        return { content: [{ type: 'text', text: JSON.stringify(data) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'lookup_failed';
        if (message.includes('404')) {
          return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: 'vessel_not_found' }) }] };
        }
        return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: message }) }] };
      }
    }
  );

  server.registerTool(
    'get_registry_stats',
    {
      title: 'Get aggregate vessel counts',
      description: 'Aggregate public vessel counts for answering "how many vessels" questions.',
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => {
      try {
        const data = await getJson(`${API_BASE}/stats`);
        return { content: [{ type: 'text', text: JSON.stringify(data) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'stats_failed';
        return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: message }) }] };
      }
    }
  );

  server.registerTool(
    'get_dataset_metadata',
    {
      title: 'Describe available vessel-registry datasets',
      description:
        'Describes available data sources (Державний судновий реєстр / Суднова книга), freshness (import dates), record counts, and available fields.',
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => {
      try {
        const data = await getJson(`${API_BASE}/meta`);
        return { content: [{ type: 'text', text: JSON.stringify(data) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'metadata_failed';
        return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: message }) }] };
      }
    }
  );

  return server;
}