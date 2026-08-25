import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/**
 * Base URL of the public SudnoKontrol API.
 * Override with SUDNOKONTROL_API env var.
 */
const API_BASE = process.env.SUDNOKONTROL_API || 'https://api.sk.ukrfish.org/api/ai';

/**
 * Read-only hints shared by all SudnoKontrol tools (required by OpenAI plugin review).
 * These tools query two fixed registry datasets through a defined API — they never
 * modify anything, are idempotent, and operate on a bounded/closed data source
 * (not an open world of arbitrary external entities), hence openWorldHint=false.
 */
const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

async function getJson(url: string): Promise<Record<string, unknown>> {
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
    version: '1.0.1',
  });

  // Output schemas (structured content) — permissive passthrough so proxy
  // responses that evolve over time still validate.
  const vesselRecord = z.object({
    registration_number: z.string(),
    name: z.string(),
    vessel_type: z.string().nullable().optional(),
    owner_name: z.string().nullable().optional(),
    owner_address: z.string().nullable().optional(),
    build_year: z.number().int().nullable().optional(),
    home_port: z.string().nullable().optional(),
    tonnage: z.union([z.string(), z.number()]).nullable().optional(),
    source: z.string().optional(),
    source_name: z.string().optional(),
    match: z.object({ field: z.string(), score: z.number() }).optional(),
    web_url: z.string().optional(),
  }).passthrough();
  const searchOutput = z.object({
    items: z.array(vesselRecord),
    total: z.number().int(),
  }).passthrough();
  const statsOutput = z.object({
    total_vessels: z.number().int().optional(),
    sources: z.array(z.object({
      source: z.string(),
      name: z.string(),
      count: z.number().int(),
    })).optional(),
  }).passthrough();
  const metaOutput = z.object({
    api: z.object({ name: z.string(), version: z.string(), description: z.string() }).optional(),
    data_sources: z.array(z.object({
      source: z.string(),
      name: z.string(),
      imported_at: z.string().nullable().optional(),
      record_count: z.number().int(),
    })).optional(),
    example_queries: z.array(z.string()).optional(),
    fields: z.array(z.string()).optional(),
  }).passthrough();

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
      outputSchema: searchOutput,
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
        const payload = { items: data.items, total: data.total };
        return {
          structuredContent: payload,
          content: [{ type: 'text', text: JSON.stringify(payload) }],
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
      outputSchema: vesselRecord,
    },
    async (args) => {
      try {
        const a = args || {};
        const data = await getJson(
          `${API_BASE}/registry/lookup/${encodeURIComponent(a.registration_number)}`
        );
        return {
          structuredContent: data,
          content: [{ type: 'text', text: JSON.stringify(data) }],
        };
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
      outputSchema: statsOutput,
    },
    async () => {
      try {
        const data = await getJson(`${API_BASE}/stats`);
        return {
          structuredContent: data,
          content: [{ type: 'text', text: JSON.stringify(data) }],
        };
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
      outputSchema: metaOutput,
    },
    async () => {
      try {
        const data = await getJson(`${API_BASE}/meta`);
        return {
          structuredContent: data,
          content: [{ type: 'text', text: JSON.stringify(data) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'metadata_failed';
        return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: message }) }] };
      }
    }
  );

  return server;
}